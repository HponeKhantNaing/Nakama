'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  FactoryResponseStatus,
  NegotiationAction,
  YokomochiOrderStatus,
  YokomochiTripStatus,
  CompanyType,
  UserRole,
  CarrierRequestStatus,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole, resolveSessionUserId } from '@/lib/session';
import {
  calculateTripsFromPallets,
  generateOrderNo,
  palletsForTrip,
} from '@/lib/yokomochi/trip-calculation';
import {
  getCarrierEligibleTrips,
  splitAmongSubcontractors,
} from '@/lib/yokomochi/carrier-allocation';
import { getYokomochiVehicleLabel } from '@/lib/yokomochi/vehicle-capacity';
import { ActionResult } from '@/types';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
const BOXES_PER_PALLET = 16;

function calculatePalletsFromBoxes(boxes: number) {
  return Math.ceil(Math.max(0, boxes) / BOXES_PER_PALLET);
}

async function createTripsFromFactoryResponse(
  tx: Tx,
  yokomochiOrderId: string,
  availablePallets: number,
  availableBoxes: number
) {
  const calc = calculateTripsFromPallets(availablePallets);
  const order = await tx.yokomochiOrder.findUnique({ where: { id: yokomochiOrderId } });

  await tx.yokomochiOrder.update({
    where: { id: yokomochiOrderId },
    data: {
      status: YokomochiOrderStatus.TRIPS_CALCULATED,
      totalTrips: calc.totalTrips,
      remainderPallets: calc.remainderPallets,
    },
  });

  const existingTrips = await tx.yokomochiTrip.count({ where: { yokomochiOrderId } });
  if (existingTrips === 0) {
    for (let i = 1; i <= calc.totalTrips; i++) {
      const pallets = palletsForTrip(i, availablePallets);
      await tx.yokomochiTrip.create({
        data: {
          yokomochiOrderId,
          tripNo: i,
          tripCode: `${order?.orderNo}-T${i}`,
          pallets,
          boxes: Math.round((availableBoxes / availablePallets) * pallets) || 0,
          status: YokomochiTripStatus.PLANNED,
        },
      });
    }
  }

  return calc;
}

const factoryRequestSchema = z.object({
  factoryCompanyId: z.string(),
  requestedPallets: z.coerce.number().int().positive().optional(),
  requestedBoxes: z.coerce.number().int().positive(),
  requestedDate: z.string(),
  cargoType: z.string().optional(),
  productName: z.string().optional(),
  notes: z.string().optional(),
});

export async function createFactoryRequest(
  input: z.infer<typeof factoryRequestSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = factoryRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid request data' };

    const data = parsed.data;
    const orderNo = generateOrderNo();
    const createdById = await resolveSessionUserId(session);
    const requestedPallets = calculatePalletsFromBoxes(data.requestedBoxes);

    const order = await prisma.$transaction(async (tx) => {
      const yokomochiOrder = await tx.yokomochiOrder.create({
        data: {
          orderNo,
          status: YokomochiOrderStatus.FACTORY_PENDING,
          cargoType: data.cargoType,
          productName: data.productName,
        },
      });

      await tx.factoryRequest.create({
        data: {
          yokomochiOrderId: yokomochiOrder.id,
          warehouseCompanyId: session.user.companyId,
          factoryCompanyId: data.factoryCompanyId,
          createdById,
          // Quantity is kept for the existing schema, but boxes are now the source of truth.
          requestedQuantity: data.requestedBoxes,
          requestedPallets,
          requestedBoxes: data.requestedBoxes,
          requestedDate: new Date(data.requestedDate),
          cargoType: data.cargoType,
          notes: data.notes,
        },
      });

      return yokomochiOrder;
    });

    revalidatePath('/warehouse');
    revalidatePath('/factory');
    return { success: true, data: order };
  } catch (e) {
    console.error('createFactoryRequest:', e);
    return { success: false, error: 'Failed to create factory request' };
  }
}

const factoryResponseSchema = z.object({
  yokomochiOrderId: z.string(),
  availableQuantity: z.coerce.number().int().positive(),
  availablePallets: z.coerce.number().int().positive(),
  availableBoxes: z.coerce.number().int().positive(),
  availableDate: z.string(),
  negotiationStatus: z.enum(['FULL', 'PARTIAL', 'REJECTED']),
  notes: z.string().optional(),
});

export async function submitFactoryResponse(
  input: z.infer<typeof factoryResponseSchema>
): Promise<ActionResult> {
  try {
    await requireRole(['FACTORY_STAFF']);
    const parsed = factoryResponseSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid response data' };

    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.factoryResponse.upsert({
        where: { yokomochiOrderId: data.yokomochiOrderId },
        create: {
          yokomochiOrderId: data.yokomochiOrderId,
          availableQuantity: data.availableQuantity,
          availablePallets: data.availablePallets,
          availableBoxes: data.availableBoxes,
          availableDate: new Date(data.availableDate),
          negotiationStatus: data.negotiationStatus as FactoryResponseStatus,
          notes: data.notes,
        },
        update: {
          availableQuantity: data.availableQuantity,
          availablePallets: data.availablePallets,
          availableBoxes: data.availableBoxes,
          availableDate: new Date(data.availableDate),
          negotiationStatus: data.negotiationStatus as FactoryResponseStatus,
          notes: data.notes,
          respondedAt: new Date(),
        },
      });

      const nextStatus =
        data.negotiationStatus === 'REJECTED' || data.negotiationStatus === 'PARTIAL'
          ? YokomochiOrderStatus.NEGOTIATING
          : YokomochiOrderStatus.APPROVED;

      await tx.yokomochiOrder.update({
        where: { id: data.yokomochiOrderId },
        data: { status: nextStatus },
      });

      if (data.negotiationStatus === 'FULL') {
        await createTripsFromFactoryResponse(
          tx,
          data.yokomochiOrderId,
          data.availablePallets,
          data.availableBoxes
        );
      }
    });

    revalidatePath('/warehouse');
    revalidatePath('/factory');
    return { success: true };
  } catch (e) {
    console.error('submitFactoryResponse:', e);
    return { success: false, error: 'Failed to submit factory response' };
  }
}

const negotiationSchema = z.object({
  yokomochiOrderId: z.string(),
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_AGAIN']),
  message: z.string().optional(),
  requestedPallets: z.coerce.number().int().optional(),
});

export async function handleNegotiation(
  input: z.infer<typeof negotiationSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = negotiationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid negotiation action' };

    const { yokomochiOrderId, action, message, requestedPallets } = parsed.data;
    const response = await prisma.factoryResponse.findUnique({ where: { yokomochiOrderId } });
    if (!response) return { success: false, error: 'No factory response yet' };

    const actorUserId = await resolveSessionUserId(session);

    await prisma.$transaction(async (tx) => {
      await tx.negotiationHistory.create({
        data: {
          yokomochiOrderId,
          action: action as NegotiationAction,
          actorUserId,
          actorRole: UserRole.MARUICHI_STAFF,
          message,
          requestedPallets,
          offeredPallets: response.availablePallets,
        },
      });

      if (action === 'APPROVE') {
        await createTripsFromFactoryResponse(
          tx,
          yokomochiOrderId,
          response.availablePallets,
          response.availableBoxes
        );
      } else if (action === 'REJECT') {
        await tx.yokomochiOrder.update({
          where: { id: yokomochiOrderId },
          data: { status: YokomochiOrderStatus.CANCELLED },
        });
      } else {
        await tx.yokomochiOrder.update({
          where: { id: yokomochiOrderId },
          data: { status: YokomochiOrderStatus.FACTORY_PENDING },
        });
      }
    });

    revalidatePath('/warehouse');
    revalidatePath('/factory');
    return { success: true };
  } catch (e) {
    console.error('handleNegotiation:', e);
    return { success: false, error: 'Negotiation action failed' };
  }
}

/** For orders stuck at APPROVED before trip calc was wired (e.g. after factory FULL). */
export async function confirmOrderTrips(yokomochiOrderId: string): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const order = await prisma.yokomochiOrder.findFirst({
      where: {
        id: yokomochiOrderId,
        factoryRequest: { warehouseCompanyId: session.user.companyId },
      },
      include: { factoryResponse: true, trips: true },
    });

    if (!order?.factoryResponse) {
      return { success: false, error: 'Factory must respond before trip calculation' };
    }
    if (order.trips.length > 0) {
      return { success: false, error: 'Trips already calculated' };
    }

    await prisma.$transaction(async (tx) => {
      await createTripsFromFactoryResponse(
        tx,
        yokomochiOrderId,
        order.factoryResponse!.availablePallets,
        order.factoryResponse!.availableBoxes
      );
    });

    revalidatePath('/warehouse');
    return { success: true };
  } catch (e) {
    console.error('confirmOrderTrips:', e);
    return { success: false, error: 'Failed to calculate trips' };
  }
}

export async function getWarehouseYokomochiOrders() {
  const session = await requireRole(['MARUICHI_STAFF']);
  return prisma.yokomochiOrder.findMany({
    where: { factoryRequest: { warehouseCompanyId: session.user.companyId } },
    include: {
      factoryRequest: {
        include: {
          factoryCompany: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
        },
      },
      factoryResponse: true,
      negotiationHistory: { orderBy: { createdAt: 'desc' } },
      trips: {
        orderBy: { tripNo: 'asc' },
        include: {
          driverSchedule: true,
          internalFleetAssignment: { include: { driver: true, truck: true } },
          driverTask: {
            include: {
              driver: { include: { user: { select: { email: true } } } },
              truck: true,
            },
          },
        },
      },
      deliveryVerification: true,
      deliveryForm: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFactoryYokomochiOrders() {
  const session = await requireRole(['FACTORY_STAFF']);
  return prisma.yokomochiOrder.findMany({
    where: { factoryRequest: { factoryCompanyId: session.user.companyId } },
    include: {
      factoryRequest: { include: { warehouseCompany: { select: { id: true, name: true } } } },
      factoryResponse: true,
      negotiationHistory: { orderBy: { createdAt: 'desc' } },
      trips: {
        orderBy: { tripNo: 'asc' },
        include: {
          driverTask: {
            include: {
              driver: { include: { user: { select: { email: true } } } },
              truck: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFactoryCompanies() {
  await requireRole(['MARUICHI_STAFF']);
  return prisma.company.findMany({ where: { type: CompanyType.FACTORY }, orderBy: { name: 'asc' } });
}

export async function getDriverActiveYokomochiTask() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) return null;

  return prisma.driverTask.findFirst({
    where: { driverId: driver.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    include: { trip: { include: { yokomochiOrder: true } }, truck: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDriverYokomochiHistory() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) return [];

  return prisma.driverTask.findMany({
    where: { driverId: driver.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
    include: {
      trip: { include: { yokomochiOrder: true } },
      truck: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getYokomochiDeliveryTracking() {
  const session = await requireRole(['MARUICHI_STAFF', 'FACTORY_STAFF']);

  const orderWhere =
    session.user.role === UserRole.MARUICHI_STAFF
      ? { factoryRequest: { warehouseCompanyId: session.user.companyId } }
      : { factoryRequest: { factoryCompanyId: session.user.companyId } };

  const orders = await prisma.yokomochiOrder.findMany({
    where: {
      ...orderWhere,
      trips: { some: { driverTask: { isNot: null } } },
    },
    include: {
      factoryRequest: {
        include: {
          factoryCompany: { select: { name: true } },
          warehouseCompany: { select: { name: true } },
        },
      },
      trips: {
        where: { driverTask: { isNot: null } },
        include: {
          driverTask: {
            include: {
              driver: { include: { user: { select: { email: true } } } },
              truck: true,
            },
          },
        },
        orderBy: { tripNo: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const isWarehouse = session.user.role === UserRole.MARUICHI_STAFF;

  return orders.flatMap((order) =>
    order.trips
      .filter((trip) => trip.driverTask)
      .map((trip) => {
        const task = trip.driverTask!;
        const truck = task.truck;
        return {
          orderNo: order.orderNo,
          tripCode: trip.tripCode,
          partnerName: isWarehouse
            ? (order.factoryRequest?.factoryCompany?.name ?? '—')
            : (order.factoryRequest?.warehouseCompany?.name ?? '—'),
          cargoType: task.cargoType ?? order.cargoType,
          boxes: task.boxes,
          pallets: task.pallets,
          pickupLocation: task.pickupLocation,
          destination: task.destination,
          driverName: task.driver.name,
          driverPhone: task.driver.phone,
          driverEmail: task.driver.user?.email ?? null,
          vehicleLabel: truck ? getYokomochiVehicleLabel(truck.truckType) : null,
          plateNumber: truck?.plateNumber ?? null,
          taskStatus: task.status,
          tripStatus: trip.status,
          arrivedFactoryAt: task.arrivedFactoryAt,
          loadedAt: task.loadedAt,
          startedAt: task.startedAt,
          arrivedWarehouseAt: task.arrivedWarehouseAt,
          completedAt: task.completedAt,
          updatedAt: task.updatedAt,
        };
      })
  );
}

export async function updateDriverTaskStatus(
  taskId: string,
  status: 'ARRIVED_FACTORY' | 'LOADED_CARGO' | 'IN_TRANSIT' | 'ARRIVED_WAREHOUSE'
) {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) return { success: false, error: 'Driver not found' };

  const task = await prisma.driverTask.findFirst({
    where: { id: taskId, driverId: driver.id },
    include: { trip: true },
  });
  if (!task) return { success: false, error: 'Task not found' };

  const now = new Date();

  const tripStatusForStep: Partial<Record<typeof status, YokomochiTripStatus>> = {
    ARRIVED_FACTORY: YokomochiTripStatus.IN_PROGRESS,
    LOADED_CARGO: YokomochiTripStatus.IN_PROGRESS,
    IN_TRANSIT: YokomochiTripStatus.IN_PROGRESS,
    ARRIVED_WAREHOUSE: YokomochiTripStatus.ARRIVED_WAREHOUSE,
  };

  await prisma.$transaction(async (tx) => {
    await tx.driverTask.update({
      where: { id: taskId },
      data: {
        status,
        ...(status === 'ARRIVED_FACTORY' && { arrivedFactoryAt: now }),
        ...(status === 'LOADED_CARGO' && { loadedAt: now }),
        ...(status === 'IN_TRANSIT' && { startedAt: now }),
        ...(status === 'ARRIVED_WAREHOUSE' && { arrivedWarehouseAt: now }),
      },
    });

    const nextTripStatus = tripStatusForStep[status];
    if (nextTripStatus) {
      await tx.yokomochiTrip.update({
        where: { id: task.trip.id },
        data: { status: nextTripStatus },
      });
    }

    if (['ARRIVED_FACTORY', 'LOADED_CARGO', 'IN_TRANSIT'].includes(status)) {
      await tx.yokomochiOrder.update({
        where: { id: task.trip.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.IN_PROGRESS },
      });
    }

    if (status === 'ARRIVED_WAREHOUSE') {
      await tx.yokomochiOrder.update({
        where: { id: task.trip.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.AWAITING_VERIFICATION },
      });
      await tx.deliveryVerification.upsert({
        where: { yokomochiOrderId: task.trip.yokomochiOrderId },
        create: {
          yokomochiOrderId: task.trip.yokomochiOrderId,
          verifiedPallets: task.pallets,
          verifiedBoxes: task.boxes,
          driverInfo: driver.name,
        },
        update: { verifiedPallets: task.pallets, verifiedBoxes: task.boxes },
      });
    }
  });

  revalidatePath('/driver');
  revalidatePath('/warehouse');
  revalidatePath('/factory');
  return { success: true };
}

export async function verifyWarehouseDelivery(input: {
  yokomochiOrderId: string;
  approved: boolean;
  notes?: string;
}) {
  const session = await requireRole(['MARUICHI_STAFF']);

  await prisma.$transaction(async (tx) => {
    const task = await tx.driverTask.findFirst({
      where: { trip: { yokomochiOrderId: input.yokomochiOrderId } },
      include: { driver: true, truck: true },
    });

    await tx.deliveryVerification.update({
      where: { yokomochiOrderId: input.yokomochiOrderId },
      data: {
        status: input.approved ? 'APPROVED' : 'REJECTED',
        notes: input.notes,
        verifiedAt: new Date(),
      },
    });

    if (input.approved && task) {
      const order = await tx.yokomochiOrder.findUnique({ where: { id: input.yokomochiOrderId } });
      await tx.yokomochiDeliveryForm.upsert({
        where: { yokomochiOrderId: input.yokomochiOrderId },
        create: {
          yokomochiOrderId: input.yokomochiOrderId,
          deliveryNo: `DC-${order?.orderNo ?? 'UNKNOWN'}`,
          driverName: task.driver.name,
          truckInfo: task.truck?.truckNo ?? task.truck?.plateNumber ?? undefined,
          cargoType: task.cargoType,
          boxes: task.boxes,
          pallets: task.pallets,
          arrivalTime: task.arrivedWarehouseAt,
          approvedBy: session.user.name,
          completedTime: new Date(),
          verificationNote: input.notes,
        },
        update: {
          approvedBy: session.user.name,
          completedTime: new Date(),
          verificationNote: input.notes,
        },
      });

      await tx.yokomochiOrder.update({
        where: { id: input.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.COMPLETED, completedAt: new Date() },
      });

      await tx.driverTask.update({
        where: { id: task.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await tx.yokomochiTrip.updateMany({
        where: { yokomochiOrderId: input.yokomochiOrderId },
        data: { status: YokomochiTripStatus.COMPLETED },
      });
    }
  });

  revalidatePath('/warehouse');
  revalidatePath('/factory');
  revalidatePath('/driver');
  return { success: true };
}

export async function getDriverSchedule(date: string) {
  const session = await requireRole(['MARUICHI_STAFF']);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [drivers, schedules] = await Promise.all([
    prisma.driver.findMany({ where: { companyId: session.user.companyId }, orderBy: { name: 'asc' } }),
    prisma.driverSchedule.findMany({
      where: {
        driver: { companyId: session.user.companyId },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      include: { driver: true, truck: true, trip: { include: { yokomochiOrder: true } } },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return { drivers, schedules };
}

const scheduleSchema = z.object({
  tripId: z.string(),
  driverId: z.string(),
  truckId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  label: z.string().optional(),
});

export async function assignInternalFleetTrip(input: z.infer<typeof scheduleSchema>) {
  try {
    await requireRole(['MARUICHI_STAFF']);
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid schedule data' };

    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.internalFleetAssignment.upsert({
        where: { tripId: data.tripId },
        create: { tripId: data.tripId, truckId: data.truckId, driverId: data.driverId },
        update: { truckId: data.truckId, driverId: data.driverId },
      });

      await tx.driverSchedule.upsert({
        where: { tripId: data.tripId },
        create: {
          tripId: data.tripId,
          driverId: data.driverId,
          truckId: data.truckId,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          label: data.label,
        },
        update: {
          driverId: data.driverId,
          truckId: data.truckId,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          label: data.label,
        },
      });

      await tx.yokomochiTrip.update({
        where: { id: data.tripId },
        data: { status: YokomochiTripStatus.INTERNAL_ASSIGNED },
      });

      const trip = await tx.yokomochiTrip.findUnique({
        where: { id: data.tripId },
        include: { yokomochiOrder: true },
      });

      if (trip) {
        await tx.driverTask.upsert({
          where: { tripId: data.tripId },
          create: {
            tripId: data.tripId,
            driverId: data.driverId,
            truckId: data.truckId,
            pickupLocation: '飲料工場',
            destination: '20号物流センター',
            cargoType: trip.yokomochiOrder.cargoType,
            boxes: trip.boxes,
            pallets: trip.pallets,
            eta: new Date(data.endTime),
          },
          update: { driverId: data.driverId, truckId: data.truckId },
        });
      }

      await tx.truck.update({ where: { id: data.truckId }, data: { status: 'IN_USE' } });
      await tx.driver.update({
        where: { id: data.driverId },
        data: { isAvailable: false, status: 'DRIVING' },
      });

      await tx.yokomochiOrder.update({
        where: { id: trip!.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.INTERNAL_SCHEDULING },
      });
    });

    revalidatePath('/warehouse');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('assignInternalFleetTrip:', e);
    return { success: false, error: 'Failed to assign trip' };
  }
}

const carrierRequestSchema = z.object({
  yokomochiOrderId: z.string(),
  carrierCompanyId: z.string(),
  notes: z.string().optional(),
});

export async function sendCarrierRequest(
  input: z.infer<typeof carrierRequestSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = carrierRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid carrier request' };

    const { yokomochiOrderId, carrierCompanyId, notes } = parsed.data;

    const order = await prisma.yokomochiOrder.findUnique({
      where: { id: yokomochiOrderId },
      include: {
        factoryRequest: true,
        trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
        carrierRequest: true,
      },
    });

    if (!order?.factoryRequest) return { success: false, error: 'Order not found' };
    if (order.factoryRequest.warehouseCompanyId !== session.user.companyId) {
      return { success: false, error: 'Unauthorized' };
    }

    const eligible = getCarrierEligibleTrips(order.trips);
    if (eligible.length === 0) {
      return { success: false, error: 'No remaining trips for external carrier' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.carrierRequest.upsert({
        where: { yokomochiOrderId },
        create: {
          yokomochiOrderId,
          warehouseCompanyId: session.user.companyId,
          carrierCompanyId,
          requestedTrips: eligible.length,
          notes,
          status: CarrierRequestStatus.PENDING,
        },
        update: {
          carrierCompanyId,
          requestedTrips: eligible.length,
          notes,
          status: CarrierRequestStatus.PENDING,
        },
      });

      await tx.yokomochiOrder.update({
        where: { id: yokomochiOrderId },
        data: { status: YokomochiOrderStatus.CARRIER_PENDING },
      });
    });

    revalidatePath('/warehouse');
    revalidatePath('/carrier');
    return { success: true, data: { requestedTrips: eligible.length } };
  } catch (e) {
    console.error('sendCarrierRequest:', e);
    return { success: false, error: 'Failed to send carrier request' };
  }
}

const carrierResponseSchema = z.object({
  carrierRequestId: z.string(),
  availableTrips: z.coerce.number().int().min(0),
  truckCount: z.coerce.number().int().min(0),
  driverCount: z.coerce.number().int().min(0),
  truckInfo: z.string().optional(),
  driverInfo: z.string().optional(),
  estimatedPickupTime: z.string().optional(),
  notes: z.string().optional(),
});

export async function submitCarrierResponse(
  input: z.infer<typeof carrierResponseSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const parsed = carrierResponseSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid carrier response' };

    const data = parsed.data;
    const request = await prisma.carrierRequest.findUnique({
      where: { id: data.carrierRequestId },
      include: {
        yokomochiOrder: {
          include: {
            trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
          },
        },
      },
    });

    if (!request || request.carrierCompanyId !== session.user.companyId) {
      return { success: false, error: 'Request not found' };
    }

    const eligible = getCarrierEligibleTrips(request.yokomochiOrder.trips);

    if (data.availableTrips > 0 && eligible.length === 0) {
      return {
        success: false,
        error:
          'No carrier-eligible trips remain on this order. Ask the warehouse to release trips or send a new request.',
      };
    }

    const carrierTripCount = Math.min(data.availableTrips, eligible.length);
    const carrierTripIds = eligible.slice(0, carrierTripCount).map((t) => t.id);
    const subcontractTripIds = eligible.slice(carrierTripCount).map((t) => t.id);

    if (data.availableTrips > 0 && carrierTripCount === 0) {
      return { success: false, error: 'No trips could be assigned to your fleet' };
    }

    const subcontractors = await prisma.company.findMany({
      where: { type: CompanyType.SUBCONTRACTOR },
      orderBy: { name: 'asc' },
    });

    const splits = splitAmongSubcontractors(
      subcontractTripIds,
      subcontractors.map((s) => s.id)
    );

    const requestStatus =
      data.availableTrips === 0
        ? CarrierRequestStatus.REJECTED
        : carrierTripCount < data.availableTrips || carrierTripCount < eligible.length
          ? CarrierRequestStatus.PARTIAL
          : CarrierRequestStatus.ACCEPTED;

    await prisma.$transaction(async (tx) => {
      await tx.carrierResponse.upsert({
        where: { carrierRequestId: data.carrierRequestId },
        create: {
          carrierRequestId: data.carrierRequestId,
          availableTrips: data.availableTrips,
          truckCount: data.truckCount,
          driverCount: data.driverCount,
          truckInfo: data.truckInfo,
          driverInfo: data.driverInfo,
          estimatedPickupTime: data.estimatedPickupTime
            ? new Date(data.estimatedPickupTime)
            : undefined,
          notes: data.notes,
        },
        update: {
          availableTrips: data.availableTrips,
          truckCount: data.truckCount,
          driverCount: data.driverCount,
          truckInfo: data.truckInfo,
          driverInfo: data.driverInfo,
          estimatedPickupTime: data.estimatedPickupTime
            ? new Date(data.estimatedPickupTime)
            : undefined,
          notes: data.notes,
          respondedAt: new Date(),
        },
      });

      await tx.carrierRequest.update({
        where: { id: data.carrierRequestId },
        data: { status: requestStatus },
      });

      if (carrierTripIds.length > 0) {
        await tx.yokomochiTrip.updateMany({
          where: { id: { in: carrierTripIds } },
          data: {
            status: YokomochiTripStatus.CARRIER_ASSIGNED,
            carrierCompanyId: request.carrierCompanyId,
          },
        });
      }

      for (const split of splits) {
        for (const tripId of split.tripIds) {
          await tx.yokomochiSubcontractAssignment.upsert({
            where: { tripId },
            create: {
              tripId,
              subcontractorId: split.subcontractorId,
              assignedTrips: 1,
            },
            update: { subcontractorId: split.subcontractorId },
          });
          await tx.yokomochiTrip.update({
            where: { id: tripId },
            data: { status: YokomochiTripStatus.SUBCONTRACT_ASSIGNED },
          });
        }
      }

      const nextStatus =
        splits.length > 0
          ? YokomochiOrderStatus.SUBCONTRACTING
          : carrierTripIds.length > 0
            ? YokomochiOrderStatus.DRIVER_ASSIGNED
            : YokomochiOrderStatus.CARRIER_PENDING;

      await tx.yokomochiOrder.update({
        where: { id: request.yokomochiOrderId },
        data: { status: nextStatus },
      });
    });

    revalidatePath('/warehouse');
    revalidatePath('/carrier');
    revalidatePath('/carrier/requests');
    revalidatePath('/carrier/accepted');
    return {
      success: true,
      data: {
        carrierTrips: carrierTripIds.length,
        subcontractTrips: subcontractTripIds.length,
        splits: splits.length,
      },
    };
  } catch (e) {
    console.error('submitCarrierResponse:', e);
    return { success: false, error: 'Failed to submit carrier response' };
  }
}

const carrierDriverAssignSchema = z.object({
  tripId: z.string(),
  driverId: z.string(),
  truckId: z.string(),
  eta: z.string().optional(),
});

export async function assignCarrierTripDriver(
  input: z.infer<typeof carrierDriverAssignSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const parsed = carrierDriverAssignSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid assignment' };

    const { tripId, driverId, truckId, eta } = parsed.data;

    const trip = await prisma.yokomochiTrip.findUnique({
      where: { id: tripId },
      include: { yokomochiOrder: true },
    });

    if (!trip || trip.carrierCompanyId !== session.user.companyId) {
      return { success: false, error: 'Trip not found' };
    }
    if (trip.status !== YokomochiTripStatus.CARRIER_ASSIGNED) {
      return { success: false, error: 'Trip is not awaiting driver assignment' };
    }

    const driver = await prisma.driver.findFirst({
      where: { id: driverId, companyId: session.user.companyId },
    });
    const truck = await prisma.truck.findFirst({
      where: { id: truckId, companyId: session.user.companyId },
    });
    if (!driver || !truck) return { success: false, error: 'Driver or truck not found' };

    await prisma.$transaction(async (tx) => {
      await tx.yokomochiTrip.update({
        where: { id: tripId },
        data: { status: YokomochiTripStatus.DRIVER_ASSIGNED },
      });

      await tx.driverTask.upsert({
        where: { tripId },
        create: {
          tripId,
          driverId,
          truckId,
          pickupLocation: '飲料工場',
          destination: '20号物流センター',
          cargoType: trip.yokomochiOrder.cargoType,
          boxes: trip.boxes,
          pallets: trip.pallets,
          eta: eta ? new Date(eta) : undefined,
        },
        update: { driverId, truckId, eta: eta ? new Date(eta) : undefined },
      });

      await tx.truck.update({ where: { id: truckId }, data: { status: 'IN_USE' } });
      await tx.driver.update({
        where: { id: driverId },
        data: { isAvailable: false, status: 'DRIVING' },
      });
    });

    revalidatePath('/carrier');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('assignCarrierTripDriver:', e);
    return { success: false, error: 'Failed to assign driver' };
  }
}

export async function getCarrierCompanies() {
  await requireRole(['MARUICHI_STAFF']);
  return prisma.company.findMany({
    where: { type: CompanyType.SHINWA },
    orderBy: { name: 'asc' },
  });
}

export async function getWarehouseExternalCarrierOrders() {
  const session = await requireRole(['MARUICHI_STAFF']);
  return prisma.yokomochiOrder.findMany({
    where: {
      factoryRequest: { warehouseCompanyId: session.user.companyId },
      status: {
        in: [
          YokomochiOrderStatus.TRIPS_CALCULATED,
          YokomochiOrderStatus.INTERNAL_SCHEDULING,
          YokomochiOrderStatus.CARRIER_PENDING,
          YokomochiOrderStatus.SUBCONTRACTING,
          YokomochiOrderStatus.DRIVER_ASSIGNED,
        ],
      },
    },
    include: {
      factoryRequest: { include: { factoryCompany: { select: { name: true } } } },
      trips: {
        orderBy: { tripNo: 'asc' },
        include: { internalFleetAssignment: { include: { driver: true, truck: true } } },
      },
      carrierRequest: { include: { response: true, carrierCompany: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWarehouseSubcontractOverview() {
  const session = await requireRole(['MARUICHI_STAFF']);
  return prisma.yokomochiSubcontractAssignment.findMany({
    where: {
      trip: { yokomochiOrder: { factoryRequest: { warehouseCompanyId: session.user.companyId } } },
    },
    include: {
      trip: { include: { yokomochiOrder: { select: { orderNo: true, status: true } } } },
      subcontractor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCarrierYokomochiRequests() {
  const session = await requireRole(['SHINWA_STAFF']);
  return prisma.carrierRequest.findMany({
    where: { carrierCompanyId: session.user.companyId },
    include: {
      yokomochiOrder: {
        include: {
          factoryRequest: {
            include: { warehouseCompany: { select: { name: true } }, factoryCompany: { select: { name: true } } },
          },
          trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
        },
      },
      response: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCarrierAcceptedTrips() {
  const session = await requireRole(['SHINWA_STAFF']);
  return prisma.yokomochiTrip.findMany({
    where: {
      carrierCompanyId: session.user.companyId,
      status: { in: [YokomochiTripStatus.CARRIER_ASSIGNED, YokomochiTripStatus.DRIVER_ASSIGNED] },
    },
    include: {
      yokomochiOrder: { select: { orderNo: true, cargoType: true } },
      driverTask: { include: { driver: true, truck: true } },
    },
    orderBy: { tripNo: 'asc' },
  });
}

export async function getCarrierSubcontractTrips() {
  const session = await requireRole(['SHINWA_STAFF']);
  return prisma.yokomochiSubcontractAssignment.findMany({
    where: {
      trip: {
        yokomochiOrder: {
          carrierRequest: { carrierCompanyId: session.user.companyId },
        },
      },
    },
    include: {
      trip: { include: { yokomochiOrder: { select: { orderNo: true } } } },
      subcontractor: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCarrierCompletedTrips() {
  const session = await requireRole(['SHINWA_STAFF']);
  return prisma.yokomochiTrip.findMany({
    where: {
      carrierCompanyId: session.user.companyId,
      status: { in: [YokomochiTripStatus.COMPLETED, YokomochiTripStatus.VERIFIED, YokomochiTripStatus.ARRIVED_WAREHOUSE] },
    },
    include: {
      yokomochiOrder: { select: { orderNo: true, completedAt: true } },
      driverTask: { include: { driver: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getCarrierFleetResources() {
  const session = await requireRole(['SHINWA_STAFF']);
  const [drivers, trucks] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.user.companyId, isAvailable: true },
      orderBy: { name: 'asc' },
    }),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId, status: 'AVAILABLE' },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);
  return { drivers, trucks };
}
