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
  NotificationType,
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
  countRemainingCarrierTrips,
  splitAmongSubcontractors,
} from '@/lib/yokomochi/carrier-allocation';
import { getYokomochiVehicleLabel } from '@/lib/yokomochi/vehicle-capacity';
import { findScheduleConflict } from '@/lib/yokomochi/schedule-conflicts';
import { releaseYokomochiFleetResources } from '@/lib/yokomochi/fleet-release';
import {
  buildDeliverySchedulesFromNegotiation,
  calculatePalletsFromBoxes,
  createDeliverySchedulesWithTrips,
} from '@/lib/yokomochi/delivery-schedule';
import {
  isValidOrderBoxQuantity,
  wholePalletsFromBoxes,
} from '@/lib/yokomochi/pallet-capacity';
import { factoryMaySubmitResponse } from '@/app/actions/negotiation-chat';
import { localDayBounds, toLocalDateString } from '@/lib/yokomochi/dates';
import { normalizeTripScanInput, isTripLegCode, parseYokomochiScanPayload } from '@/lib/yokomochi/trip-scan';
import {
  generateArrivalToken,
  getArrivalTokenExpiry,
  getYokomochiQrPayload,
} from '@/lib/yokomochi/qr-arrival';
import { ActionResult } from '@/types';
import type { Prisma } from '@prisma/client';
import { notifyYokomochiParties } from '@/lib/notifications';

export type YokomochiArrivalLookup = {
  tripId: string;
  tripCode: string;
  tripNo: number;
  totalTrips: number;
  completedTrips: number;
  tripStatus: YokomochiTripStatus;
  orderNo: string;
  orderId: string;
  productName: string | null;
  factoryName: string;
  destination: string;
  cargoType: string | null;
  boxes: number;
  pallets: number;
  driverName: string;
  truckLabel: string | null;
  taskStatus: string;
  verificationStatus: string;
  arrivedWarehouseAt: Date | null;
  alreadyConfirmed: boolean;
  qrExpired: boolean;
};

type Tx = Prisma.TransactionClient;

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

/** Keep carrier request trip count in sync after internal fleet assignments. */
export async function syncCarrierRequestRemainingTrips(yokomochiOrderId: string) {
  const order = await prisma.yokomochiOrder.findUnique({
    where: { id: yokomochiOrderId },
    include: {
      trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
      carrierRequests: { where: { status: CarrierRequestStatus.PENDING } },
    },
  });

  if (!order) return 0;

  for (const req of order.carrierRequests) {
    const scheduleTrips = req.deliveryScheduleId
      ? order.trips.filter((t) => t.deliveryScheduleId === req.deliveryScheduleId)
      : order.trips;
    const remaining = countRemainingCarrierTrips(scheduleTrips);
    if (remaining !== req.requestedTrips) {
      await prisma.carrierRequest.update({
        where: { id: req.id },
        data: { requestedTrips: remaining },
      });
    }
  }

  return countRemainingCarrierTrips(order.trips);
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
    if (!isValidOrderBoxQuantity(data.requestedBoxes)) {
      return {
        success: false,
        error:
          'Order quantity must match full truck pallet capacities (Multiples of 5 or 16 Pallets).',
      };
    }

    const orderNo = generateOrderNo();
    const createdById = await resolveSessionUserId(session);
    if (!createdById) return { success: false, error: 'User not found' };
    const requestedPallets = wholePalletsFromBoxes(data.requestedBoxes);

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

      await tx.negotiationChatMessage.create({
        data: {
          yokomochiOrderId: yokomochiOrder.id,
          senderUserId: createdById,
          senderRole: UserRole.MARUICHI_STAFF,
          senderCompanyId: session.user.companyId,
         // message: `Request: ${data.requestedBoxes} boxes needed by ${data.requestedDate}. Please confirm availability via chat before your formal response.`,msg
          message: JSON.stringify({
            i18nKey: 'negotiation.autoRequestMessage',
            params: { boxes: data.requestedBoxes, date: data.requestedDate },
          }),
        },
      });

      return yokomochiOrder;
    });

    await notifyYokomochiParties(order.id, {
      type: NotificationType.NEW_REQUEST,
      title: 'New factory request',
      message: `Order ${orderNo}: ${data.requestedBoxes} boxes requested`,
      targets: { factory: true },
      metadata: { href: '/factory/negotiation' },
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
  nextAvailableDate: z.string().optional(),
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

    const factoryRequest = await prisma.factoryRequest.findUnique({
      where: { yokomochiOrderId: data.yokomochiOrderId },
    });
    if (!factoryRequest) return { success: false, error: 'Factory request not found' };

    const chatGate = await factoryMaySubmitResponse(data.yokomochiOrderId);
    if (!chatGate.ok) {
      return { success: false, error: chatGate.error ?? 'Negotiation chat required before response' };
    }

    const requestedBoxes = factoryRequest.requestedBoxes;
    const remainingBoxes = Math.max(0, requestedBoxes - data.availableBoxes);

    if (data.negotiationStatus === 'PARTIAL') {
      if (remainingBoxes <= 0) {
        return { success: false, error: 'Partial response requires fewer boxes than requested' };
      }
      if (!data.nextAvailableDate) {
        return { success: false, error: 'Next available date required for partial delivery' };
      }
    }

    const nextDate =
      data.nextAvailableDate && data.negotiationStatus === 'PARTIAL'
        ? new Date(data.nextAvailableDate)
        : null;

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

      await tx.factoryNegotiation.upsert({
        where: { yokomochiOrderId: data.yokomochiOrderId },
        create: {
          factoryRequestId: factoryRequest.id,
          yokomochiOrderId: data.yokomochiOrderId,
          requestedBoxes,
          availableBoxes: data.availableBoxes,
          remainingBoxes:
            data.negotiationStatus === 'FULL' ? 0 : remainingBoxes,
          availableDate: new Date(data.availableDate),
          nextAvailableDate: nextDate,
          status: data.negotiationStatus as FactoryResponseStatus,
          notes: data.notes,
        },
        update: {
          requestedBoxes,
          availableBoxes: data.availableBoxes,
          remainingBoxes:
            data.negotiationStatus === 'FULL' ? 0 : remainingBoxes,
          availableDate: new Date(data.availableDate),
          nextAvailableDate: nextDate,
          status: data.negotiationStatus as FactoryResponseStatus,
          notes: data.notes,
          respondedAt: new Date(),
        },
      });

      const nextStatus =
        data.negotiationStatus === 'REJECTED'
          ? YokomochiOrderStatus.CANCELLED
          : YokomochiOrderStatus.NEGOTIATING;

      await tx.yokomochiOrder.update({
        where: { id: data.yokomochiOrderId },
        data: { status: nextStatus },
      });
    });

    await notifyYokomochiParties(data.yokomochiOrderId, {
      type: NotificationType.STATUS_UPDATE,
      title: 'Factory response received',
      message: `Factory submitted ${data.negotiationStatus} availability`,
      targets: { warehouse: true },
      metadata: { href: '/warehouse/negotiations' },
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

    const [negotiation, factoryRequest, order] = await Promise.all([
      prisma.factoryNegotiation.findUnique({ where: { yokomochiOrderId } }),
      prisma.factoryRequest.findUnique({ where: { yokomochiOrderId } }),
      prisma.yokomochiOrder.findUnique({ where: { id: yokomochiOrderId } }),
    ]);

    if (!negotiation || !factoryRequest || !order) {
      return { success: false, error: 'No factory negotiation yet' };
    }

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
          offeredPallets: calculatePalletsFromBoxes(negotiation.availableBoxes),
        },
      });

      if (action === 'APPROVE') {
        const schedules = buildDeliverySchedulesFromNegotiation({
          requestedBoxes: negotiation.requestedBoxes,
          availableBoxes: negotiation.availableBoxes,
          remainingBoxes: negotiation.remainingBoxes,
          availableDate: negotiation.availableDate,
          nextAvailableDate: negotiation.nextAvailableDate,
          status: negotiation.status,
        });

        await createDeliverySchedulesWithTrips(tx, {
          factoryRequestId: factoryRequest.id,
          yokomochiOrderId,
          orderNo: order.orderNo,
          schedules,
        });

        await tx.factoryNegotiation.update({
          where: { id: negotiation.id },
          data: { approvedAt: new Date() },
        });
      } else if (action === 'REJECT') {
        await tx.yokomochiOrder.update({
          where: { id: yokomochiOrderId },
          data: { status: YokomochiOrderStatus.CANCELLED },
        });
      } else {
        await tx.factoryNegotiation.update({
          where: { id: negotiation.id },
          data: { approvedAt: null },
        });
        await tx.yokomochiOrder.update({
          where: { id: yokomochiOrderId },
          data: { status: YokomochiOrderStatus.FACTORY_PENDING },
        });
      }
    });

    const negotiationMessages: Record<string, string> = {
      APPROVE: 'Warehouse approved the negotiation',
      REJECT: 'Warehouse rejected the negotiation',
      REQUEST_AGAIN: 'Warehouse requested renegotiation',
    };

    await notifyYokomochiParties(yokomochiOrderId, {
      type: action === 'REJECT' ? NotificationType.ORDER_REJECTED : NotificationType.ORDER_ACCEPTED,
      title: 'Negotiation update',
      message: negotiationMessages[action] ?? 'Negotiation updated',
      targets: { factory: true },
      metadata: { href: '/factory/negotiation' },
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
      include: {
        factoryRequest: true,
        factoryNegotiation: true,
        factoryResponse: true,
        deliverySchedules: true,
        trips: true,
      },
    });

    if (!order?.factoryNegotiation && !order?.factoryResponse) {
      return { success: false, error: 'Factory must respond before trip calculation' };
    }
    if (order.trips.length > 0 || (order.deliverySchedules?.length ?? 0) > 0) {
      return { success: false, error: 'Trips already calculated' };
    }

    const neg = order.factoryNegotiation;
    if (!neg) {
      return { success: false, error: 'Approve negotiation in Negotiations tab first' };
    }

    await prisma.$transaction(async (tx) => {
      const schedules = buildDeliverySchedulesFromNegotiation({
        requestedBoxes: neg.requestedBoxes,
        availableBoxes: neg.availableBoxes,
        remainingBoxes: neg.remainingBoxes,
        availableDate: neg.availableDate,
        nextAvailableDate: neg.nextAvailableDate,
        status: neg.status,
      });

      await createDeliverySchedulesWithTrips(tx, {
        factoryRequestId: order.factoryRequest!.id,
        yokomochiOrderId,
        orderNo: order.orderNo,
        schedules,
      });
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
      factoryNegotiation: true,
      deliverySchedules: { orderBy: { scheduleNo: 'asc' } },
      negotiationHistory: { orderBy: { createdAt: 'desc' } },
      negotiationChatMessages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
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
      factoryNegotiation: true,
      deliverySchedules: { orderBy: { scheduleNo: 'asc' } },
      negotiationHistory: { orderBy: { createdAt: 'desc' } },
      negotiationChatMessages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
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
      deliveryVerification: true,
      deliveryForm: true,
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
    orderBy: { trip: { tripNo: 'asc' } },
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
  const session = await requireRole(['MARUICHI_STAFF', 'FACTORY_STAFF', 'SHINWA_STAFF']);

  const orderWhere =
    session.user.role === UserRole.MARUICHI_STAFF
      ? { factoryRequest: { warehouseCompanyId: session.user.companyId } }
      : session.user.role === UserRole.FACTORY_STAFF
        ? { factoryRequest: { factoryCompanyId: session.user.companyId } }
        : { trips: { some: { carrierCompanyId: session.user.companyId, driverTask: { isNot: null } } } };

  const orders = await prisma.yokomochiOrder.findMany({
    where: {
      ...orderWhere,
      trips: {
        some: {
          driverTask: { isNot: null },
          ...(session.user.role === UserRole.SHINWA_STAFF
            ? { carrierCompanyId: session.user.companyId }
            : {}),
        },
      },
    },
    include: {
      deliveryVerification: true,
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
  const isCarrier = session.user.role === UserRole.SHINWA_STAFF;

  return orders.flatMap((order) =>
    order.trips
      .filter((trip) => trip.driverTask)
      .filter((trip) =>
        isCarrier ? trip.carrierCompanyId === session.user.companyId : true
      )
      .map((trip) => {
        const task = trip.driverTask!;
        const truck = task.truck;
        return {
          orderNo: order.orderNo,
          tripCode: trip.tripCode,
          tripNo: trip.tripNo,
          driverId: task.driverId,
          truckId: task.truckId,
          partnerName: isWarehouse
            ? (order.factoryRequest?.factoryCompany?.name ?? '—')
            : isCarrier
              ? (order.factoryRequest?.warehouseCompany?.name ?? '—')
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
          truckType: truck?.truckType ?? null,
          plateNumber: truck?.plateNumber ?? null,
          taskStatus: task.status,
          tripStatus: trip.status,
          verificationStatus: order.deliveryVerification?.status ?? null,
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
    include: { trip: true, truck: true },
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
        ...(status === 'ARRIVED_WAREHOUSE' && {
          arrivedWarehouseAt: now,
          qrToken: generateArrivalToken(),
          qrExpiresAt: getArrivalTokenExpiry(48),
        }),
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
          truckInfo: task.truck?.truckNo ?? task.truck?.plateNumber ?? undefined,
        },
        update: {
          verifiedPallets: task.pallets,
          verifiedBoxes: task.boxes,
          driverInfo: driver.name,
          truckInfo: task.truck?.truckNo ?? task.truck?.plateNumber ?? undefined,
        },
      });
    }
  });

  const statusMessages: Record<typeof status, string> = {
    ARRIVED_FACTORY: 'Driver arrived at factory',
    LOADED_CARGO: 'Cargo loaded',
    IN_TRANSIT: 'In transit to warehouse',
    ARRIVED_WAREHOUSE: 'Arrived at warehouse — awaiting verification',
  };

  await notifyYokomochiParties(task.trip.yokomochiOrderId, {
    type: NotificationType.STATUS_UPDATE,
    title: 'Delivery status update',
    message: `${driver.name}: ${statusMessages[status]}`,
    targets: {
      warehouse: true,
      factory: status === 'ARRIVED_WAREHOUSE',
    },
    metadata: {
      href:
        status === 'ARRIVED_WAREHOUSE'
          ? '/warehouse/factory-requests'
          : '/factory/tracking',
    },
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
    const tasks = await tx.driverTask.findMany({
      where: { trip: { yokomochiOrderId: input.yokomochiOrderId } },
      include: { driver: true, truck: true, trip: true },
    });

    await tx.deliveryVerification.upsert({
      where: { yokomochiOrderId: input.yokomochiOrderId },
      create: {
        yokomochiOrderId: input.yokomochiOrderId,
        status: input.approved ? 'APPROVED' : 'REJECTED',
        notes: input.notes,
        verifiedAt: new Date(),
        verifiedByUserId: session.user.id,
      },
      update: {
        status: input.approved ? 'APPROVED' : 'REJECTED',
        notes: input.notes,
        verifiedAt: new Date(),
        verifiedByUserId: session.user.id,
      },
    });

    if (input.approved && tasks.length > 0) {
      const order = await tx.yokomochiOrder.findUnique({ where: { id: input.yokomochiOrderId } });
      const primary = tasks[0];
      await tx.yokomochiDeliveryForm.upsert({
        where: { yokomochiOrderId: input.yokomochiOrderId },
        create: {
          yokomochiOrderId: input.yokomochiOrderId,
          deliveryNo: `DC-${order?.orderNo ?? 'UNKNOWN'}`,
          driverName: primary.driver.name,
          truckInfo: primary.truck?.truckNo ?? primary.truck?.plateNumber ?? undefined,
          cargoType: primary.cargoType,
          boxes: tasks.reduce((s, t) => s + t.boxes, 0),
          pallets: tasks.reduce((s, t) => s + t.pallets, 0),
          arrivalTime: primary.arrivedWarehouseAt,
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

      for (const task of tasks) {
        await tx.driverTask.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await releaseYokomochiFleetResources(tx, {
          truckId: task.truckId,
          driverId: task.driverId,
        });
      }

      await tx.yokomochiTrip.updateMany({
        where: { yokomochiOrderId: input.yokomochiOrderId },
        data: { status: YokomochiTripStatus.COMPLETED },
      });
    }
  });

  if (input.approved) {
    const order = await prisma.yokomochiOrder.findUnique({
      where: { id: input.yokomochiOrderId },
      select: { orderNo: true, status: true },
    });
    if (order?.status === YokomochiOrderStatus.COMPLETED) {
      await notifyYokomochiParties(input.yokomochiOrderId, {
        type: NotificationType.DELIVERY_COMPLETE,
        title: 'Delivery complete',
        message: `Order ${order.orderNo} has been verified and completed`,
        targets: { warehouse: true, factory: true },
        metadata: { href: '/factory/history' },
      });
    }
  }

  revalidatePath('/warehouse');
  revalidatePath('/factory');
  revalidatePath('/driver');
  return { success: true };
}

const yokomochiArrivalInclude = {
  yokomochiOrder: {
    include: {
      deliveryVerification: true,
      factoryRequest: {
        include: {
          factoryCompany: { select: { name: true } },
          warehouseCompany: { select: { name: true } },
        },
      },
    },
  },
  driverTask: { include: { driver: true, truck: true } },
} as const;

type YokomochiArrivalTrip = Prisma.YokomochiTripGetPayload<{ include: typeof yokomochiArrivalInclude }>;

async function countCompletedTripsForOrder(orderId: string, tx: Tx | typeof prisma = prisma) {
  return tx.yokomochiTrip.count({
    where: {
      yokomochiOrderId: orderId,
      status: YokomochiTripStatus.COMPLETED,
    },
  });
}

function mapYokomochiArrivalLookup(
  trip: YokomochiArrivalTrip,
  completedTrips: number
): YokomochiArrivalLookup | null {
  if (!trip.driverTask) return null;

  const task = trip.driverTask;
  const order = trip.yokomochiOrder;
  const qrExpired = task.qrExpiresAt ? task.qrExpiresAt < new Date() : false;

  return {
    tripId: trip.id,
    tripCode: trip.tripCode,
    tripNo: trip.tripNo,
    totalTrips: order.totalTrips || 1,
    completedTrips,
    tripStatus: trip.status,
    orderNo: order.orderNo,
    orderId: order.id,
    productName: order.productName,
    factoryName: order.factoryRequest?.factoryCompany.name ?? '—',
    destination: task.destination,
    cargoType: task.cargoType ?? order.cargoType,
    boxes: task.boxes,
    pallets: task.pallets,
    driverName: task.driver.name,
    truckLabel: task.truck?.truckNo ?? task.truck?.plateNumber ?? null,
    taskStatus: task.status,
    verificationStatus: order.deliveryVerification?.status ?? 'PENDING',
    arrivedWarehouseAt: task.arrivedWarehouseAt,
    alreadyConfirmed: task.status === 'COMPLETED',
    qrExpired,
  };
}

async function executeYokomochiTripArrivalVerification(
  tx: Tx,
  lookup: Pick<YokomochiArrivalLookup, 'tripId' | 'orderId'>,
  approved: boolean,
  options: { verifiedByUserId?: string; approvedBy?: string; notes?: string; customerIp?: string }
) {
  const task = await tx.driverTask.findFirst({
    where: { tripId: lookup.tripId },
    include: { driver: true, truck: true },
  });
  if (!task) throw new Error('Driver task not found');

  await tx.driverTask.update({
    where: { id: task.id },
    data: {
      status: approved ? 'COMPLETED' : 'CANCELLED',
      completedAt: new Date(),
      qrToken: null,
      qrExpiresAt: null,
    },
  });

  await tx.yokomochiTrip.update({
    where: { id: lookup.tripId },
    data: { status: approved ? YokomochiTripStatus.COMPLETED : YokomochiTripStatus.CANCELLED },
  });

  if (approved) {
    await releaseYokomochiFleetResources(tx, {
      truckId: task.truckId,
      driverId: task.driverId,
    });
  }

  const remaining = await tx.yokomochiTrip.count({
    where: {
      yokomochiOrderId: lookup.orderId,
      status: { notIn: [YokomochiTripStatus.COMPLETED, YokomochiTripStatus.CANCELLED] },
    },
  });

  const verificationStatus = approved ? (remaining === 0 ? 'APPROVED' : 'PENDING') : 'REJECTED';
  const noteParts = [options.notes, options.approvedBy ? `Approved by: ${options.approvedBy}` : null]
    .filter(Boolean)
    .join(' · ');

  await tx.deliveryVerification.upsert({
    where: { yokomochiOrderId: lookup.orderId },
    create: {
      yokomochiOrderId: lookup.orderId,
      status: verificationStatus,
      verifiedBoxes: task.boxes,
      verifiedPallets: task.pallets,
      driverInfo: task.driver.name,
      truckInfo: task.truck?.truckNo ?? task.truck?.plateNumber ?? undefined,
      notes: noteParts || undefined,
      verifiedAt: new Date(),
      verifiedByUserId: options.verifiedByUserId ?? undefined,
    },
    update: {
      status: verificationStatus,
      verifiedBoxes: task.boxes,
      verifiedPallets: task.pallets,
      driverInfo: task.driver.name,
      truckInfo: task.truck?.truckNo ?? task.truck?.plateNumber ?? undefined,
      notes: noteParts || undefined,
      verifiedAt: new Date(),
      verifiedByUserId: options.verifiedByUserId ?? undefined,
    },
  });

  if (approved && remaining === 0) {
    await tx.yokomochiOrder.update({
      where: { id: lookup.orderId },
      data: { status: YokomochiOrderStatus.COMPLETED, completedAt: new Date() },
    });
  }
}

export async function generateYokomochiArrivalQr(
  taskId: string,
  baseUrl?: string
): Promise<ActionResult<{ token: string; url: string }>> {
  try {
    const session = await requireRole(['DRIVER']);
    const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
    if (!driver) return { success: false, error: 'Driver not found' };

    const task = await prisma.driverTask.findFirst({
      where: { id: taskId, driverId: driver.id, status: 'ARRIVED_WAREHOUSE' },
    });
    if (!task) return { success: false, error: 'Trip not ready for warehouse QR' };

    const token = task.qrToken ?? generateArrivalToken();
    const updated = await prisma.driverTask.update({
      where: { id: taskId },
      data: {
        qrToken: token,
        qrExpiresAt: getArrivalTokenExpiry(48),
      },
    });

    return {
      success: true,
      data: { token: updated.qrToken!, url: getYokomochiQrPayload(updated.qrToken!, baseUrl) },
    };
  } catch (e) {
    console.error('generateYokomochiArrivalQr:', e);
    return { success: false, error: 'Failed to generate QR' };
  }
}

export async function lookupYokomochiArrivalByToken(
  token: string
): Promise<YokomochiArrivalLookup | null> {
  const task = await prisma.driverTask.findUnique({
    where: { qrToken: token },
    include: {
      trip: { include: yokomochiArrivalInclude },
    },
  });
  if (!task?.trip.driverTask) return null;

  const completedTrips = await countCompletedTripsForOrder(task.trip.yokomochiOrderId);
  return mapYokomochiArrivalLookup(task.trip, completedTrips);
}

export async function verifyYokomochiArrivalFromScan(
  rawPayload: string
): Promise<ActionResult & { tripCode?: string }> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = parseYokomochiScanPayload(rawPayload);
    if (!parsed) {
      return { success: false, error: 'Invalid QR code — scan the driver warehouse QR' };
    }

    if (parsed.kind === 'token') {
      const result = await confirmYokomochiArrivalByToken(parsed.token, {
        approvedBy: session.user.name ?? 'Warehouse Staff',
      });
      if (!result.success) return result;
      const lookup = await lookupYokomochiArrivalByToken(parsed.token);
      return { success: true, tripCode: lookup?.tripCode };
    }

    const result = await verifyYokomochiArrivalByTripCode(parsed.tripCode, true);
    if (!result.success) return result;
    return { success: true, tripCode: parsed.tripCode };
  } catch (e) {
    console.error('verifyYokomochiArrivalFromScan:', e);
    return { success: false, error: 'Scan verification failed' };
  }
}

export async function confirmYokomochiArrivalByToken(
  token: string,
  input: { approvedBy: string; notes?: string; customerIp?: string }
): Promise<ActionResult> {
  try {
    await requireRole(['MARUICHI_STAFF']);
    const lookup = await lookupYokomochiArrivalByToken(token);
    if (!lookup) return { success: false, error: 'Invalid confirmation token' };
    if (lookup.alreadyConfirmed) return { success: false, error: 'Already confirmed' };
    if (lookup.qrExpired) return { success: false, error: 'Token expired' };

    const readyForScan =
      lookup.taskStatus === 'ARRIVED_WAREHOUSE' ||
      lookup.tripStatus === YokomochiTripStatus.ARRIVED_WAREHOUSE;

    if (!readyForScan) {
      return {
        success: false,
        error: `Driver has not arrived at warehouse yet (current: ${lookup.taskStatus.replace(/_/g, ' ')})`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await executeYokomochiTripArrivalVerification(tx, lookup, true, {
        approvedBy: input.approvedBy,
        notes: input.notes,
        customerIp: input.customerIp,
      });
    });

    const order = await prisma.yokomochiOrder.findUnique({
      where: { id: lookup.orderId },
      select: { orderNo: true, status: true },
    });
    if (order?.status === YokomochiOrderStatus.COMPLETED) {
      await notifyYokomochiParties(lookup.orderId, {
        type: NotificationType.DELIVERY_COMPLETE,
        title: 'Delivery complete',
        message: `Order ${order.orderNo} has been verified and completed`,
        targets: { warehouse: true, factory: true },
        metadata: { href: '/factory/history' },
      });
    } else {
      await notifyYokomochiParties(lookup.orderId, {
        type: NotificationType.ARRIVED_AT_DESTINATION,
        title: 'Trip verified',
        message: `Trip ${lookup.tripCode} arrival confirmed`,
        targets: { warehouse: true, factory: true },
        metadata: { href: '/warehouse/factory-requests' },
      });
    }

    revalidatePath('/warehouse');
    revalidatePath('/factory');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('confirmYokomochiArrivalByToken:', e);
    return { success: false, error: 'Confirmation failed' };
  }
}

export async function lookupYokomochiArrival(tripCode: string) {
  const session = await requireRole(['MARUICHI_STAFF']);
  const code = normalizeTripScanInput(tripCode);
  if (!code) return null;

  const warehouseCompanyId = session.user.companyId;
  const baseWhere = {
    yokomochiOrder: { factoryRequest: { warehouseCompanyId } },
    driverTask: { isNot: null },
  };

  let trip = await prisma.yokomochiTrip.findFirst({
    where: { ...baseWhere, tripCode: { equals: code, mode: 'insensitive' } },
    include: yokomochiArrivalInclude,
  });

  if (!trip && !isTripLegCode(code)) {
    const arrivedForOrder = await prisma.yokomochiTrip.findMany({
      where: {
        ...baseWhere,
        yokomochiOrder: {
          orderNo: { equals: code, mode: 'insensitive' },
          factoryRequest: { warehouseCompanyId },
        },
        status: YokomochiTripStatus.ARRIVED_WAREHOUSE,
      },
      include: yokomochiArrivalInclude,
      orderBy: { tripNo: 'asc' },
    });
    if (arrivedForOrder.length === 1) {
      trip = arrivedForOrder[0];
    }
  }

  if (!trip?.driverTask) return null;

  const completedTrips = await countCompletedTripsForOrder(trip.yokomochiOrderId);
  return mapYokomochiArrivalLookup(trip, completedTrips);
}

export async function verifyYokomochiArrivalByTripCode(
  tripCode: string,
  approved: boolean,
  notes?: string
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const verifiedByUserId = await resolveSessionUserId(session);
    const lookup = await lookupYokomochiArrival(tripCode);
    if (!lookup) {
      return {
        success: false,
        error: 'Trip not found — scan the trip code under the QR (e.g. …-S1-T1), not the order number only',
      };
    }
    if (lookup.alreadyConfirmed) {
      return { success: false, error: 'This trip is already verified' };
    }

    const readyForScan =
      lookup.taskStatus === 'ARRIVED_WAREHOUSE' ||
      lookup.tripStatus === YokomochiTripStatus.ARRIVED_WAREHOUSE;

    if (!readyForScan) {
      return {
        success: false,
        error: `Driver has not arrived at warehouse yet (current: ${lookup.taskStatus.replace(/_/g, ' ')})`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await executeYokomochiTripArrivalVerification(tx, lookup, approved, {
        verifiedByUserId: verifiedByUserId ?? undefined,
        notes,
      });
    });

    if (approved) {
      const order = await prisma.yokomochiOrder.findUnique({
        where: { id: lookup.orderId },
        select: { orderNo: true, status: true },
      });
      if (order?.status === YokomochiOrderStatus.COMPLETED) {
        await notifyYokomochiParties(lookup.orderId, {
          type: NotificationType.DELIVERY_COMPLETE,
          title: 'Delivery complete',
          message: `Order ${order.orderNo} has been verified and completed`,
          targets: { warehouse: true, factory: true },
          metadata: { href: '/factory/history' },
        });
      } else {
        await notifyYokomochiParties(lookup.orderId, {
          type: NotificationType.ARRIVED_AT_DESTINATION,
          title: 'Trip verified',
          message: `Trip ${lookup.tripCode} arrival confirmed`,
          targets: { warehouse: true, factory: true },
          metadata: { href: '/warehouse/factory-requests' },
        });
      }
    }

    revalidatePath('/warehouse');
    revalidatePath('/factory');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('verifyYokomochiArrivalByTripCode:', e);
    return { success: false, error: 'Failed to verify arrival' };
  }
}

export async function getDriverSchedule(date: string) {
  const session = await requireRole(['MARUICHI_STAFF']);
  const { dayStart, dayEnd } = localDayBounds(date);

  const [drivers, schedules] = await Promise.all([
    prisma.driver.findMany({ where: { companyId: session.user.companyId }, orderBy: { name: 'asc' } }),
    prisma.driverSchedule.findMany({
      where: {
        driver: { companyId: session.user.companyId },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      include: {
        driver: true,
        truck: true,
        trip: {
          include: {
            yokomochiOrder: true,
            driverTask: { select: { status: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return {
    drivers,
    schedules: schedules.map((s) => ({
      ...s,
      driverTaskStatus: s.trip.driverTask?.status ?? null,
    })),
  };
}

export async function updateDriverScheduleTimes(input: {
  scheduleId: string;
  startTime: string;
  endTime: string;
}) {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const schedule = await prisma.driverSchedule.findUnique({
      where: { id: input.scheduleId },
      include: { driver: true, trip: true },
    });
    if (!schedule || schedule.driver.companyId !== session.user.companyId) {
      return { success: false, error: 'Schedule not found' };
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);

    await prisma.driverSchedule.update({
      where: { id: input.scheduleId },
      data: { startTime, endTime },
    });

    await prisma.driverTask.updateMany({
      where: { tripId: schedule.tripId },
      data: { eta: endTime },
    });

    revalidatePath('/warehouse/internal-fleet');
    return { success: true };
  } catch (e) {
    console.error('updateDriverScheduleTimes:', e);
    return { success: false, error: 'Failed to update schedule' };
  }
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
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid schedule data' };

    const data = parsed.data;

    const tripMeta = await prisma.yokomochiTrip.findUnique({
      where: { id: data.tripId },
      select: { yokomochiOrderId: true },
    });
    if (!tripMeta) return { success: false, error: 'Trip not found' };

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const { dayStart, dayEnd } = localDayBounds(toLocalDateString(startTime));

    const existingSchedules = await prisma.driverSchedule.findMany({
      where: {
        driver: { companyId: session.user.companyId },
        startTime: { gte: dayStart, lte: dayEnd },
        NOT: { tripId: data.tripId },
      },
      include: { trip: { include: { driverTask: { select: { status: true } } } } },
    });

    const scheduleEntries = existingSchedules.map((s) => ({
      driverId: s.driverId,
      truckId: s.truckId,
      startTime: s.startTime,
      endTime: s.endTime,
      driverTaskStatus: s.trip.driverTask?.status ?? null,
    }));

    const conflict = findScheduleConflict(
      data.driverId,
      data.truckId,
      startTime,
      endTime,
      scheduleEntries
    );
    if (conflict) return { success: false, error: conflict };

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
        where: { id: tripMeta.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.INTERNAL_SCHEDULING },
      });
    });

    await syncCarrierRequestRemainingTrips(tripMeta.yokomochiOrderId);

    const driver = await prisma.driver.findUnique({
      where: { id: data.driverId },
      select: { userId: true, name: true },
    });
    if (driver?.userId) {
      await notifyYokomochiParties(tripMeta.yokomochiOrderId, {
        type: NotificationType.DRIVER_ASSIGNED,
        title: 'New delivery assigned',
        message: 'You have been assigned an internal fleet trip',
        targets: { driverUserId: driver.userId },
        metadata: { href: '/driver/active-job' },
      });
    }

    revalidatePath('/warehouse');
    revalidatePath('/warehouse/internal-fleet');
    revalidatePath('/carrier');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('assignInternalFleetTrip:', e);
    return { success: false, error: 'Failed to assign trip' };
  }
}

export async function cancelYokomochiDriverAssignment(
  tripId: string
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF', 'SHINWA_STAFF']);

    const trip = await prisma.yokomochiTrip.findUnique({
      where: { id: tripId },
      include: {
        driverTask: true,
        internalFleetAssignment: true,
        yokomochiOrder: { include: { factoryRequest: true } },
      },
    });

    if (!trip?.driverTask) {
      return { success: false, error: 'No driver assignment found for this trip' };
    }

    if (trip.driverTask.status !== 'ASSIGNED') {
      return {
        success: false,
        error: 'Cannot cancel after the driver has started the delivery',
      };
    }

    const isInternal = !!trip.internalFleetAssignment || trip.status === 'INTERNAL_ASSIGNED';
    const isCarrier = trip.carrierCompanyId != null;

    if (session.user.role === 'SHINWA_STAFF') {
      if (!isCarrier || trip.carrierCompanyId !== session.user.companyId) {
        return { success: false, error: 'Not authorized to cancel this assignment' };
      }
      if (trip.status !== YokomochiTripStatus.DRIVER_ASSIGNED) {
        return { success: false, error: 'Trip is not awaiting driver acceptance' };
      }
    } else if (session.user.role === 'MARUICHI_STAFF') {
      const warehouseId = trip.yokomochiOrder.factoryRequest?.warehouseCompanyId;
      if (warehouseId && warehouseId !== session.user.companyId) {
        return { success: false, error: 'Not authorized to cancel this assignment' };
      }
      if (!isInternal && trip.status !== YokomochiTripStatus.DRIVER_ASSIGNED) {
        return { success: false, error: 'Trip is not awaiting driver acceptance' };
      }
      if (isInternal && trip.status !== YokomochiTripStatus.INTERNAL_ASSIGNED) {
        return { success: false, error: 'Trip is not awaiting driver acceptance' };
      }
    }

    const driverId = trip.driverTask.driverId;
    const truckId = trip.driverTask.truckId;

    await prisma.$transaction(async (tx) => {
      await tx.driverTask.delete({ where: { id: trip.driverTask!.id } });
      await tx.driverSchedule.deleteMany({ where: { tripId } });
      await tx.internalFleetAssignment.deleteMany({ where: { tripId } });

      if (isInternal) {
        await tx.yokomochiTrip.update({
          where: { id: tripId },
          data: { status: YokomochiTripStatus.PLANNED },
        });
      } else {
        await tx.yokomochiTrip.update({
          where: { id: tripId },
          data: { status: YokomochiTripStatus.CARRIER_ASSIGNED },
        });
      }

      await releaseYokomochiFleetResources(tx, { driverId, truckId });
    });

    await syncCarrierRequestRemainingTrips(trip.yokomochiOrderId);

    revalidatePath('/warehouse');
    revalidatePath('/warehouse/internal-fleet');
    revalidatePath('/carrier');
    revalidatePath('/carrier/accepted');
    revalidatePath('/driver');
    return { success: true };
  } catch (e) {
    console.error('cancelYokomochiDriverAssignment:', e);
    return { success: false, error: 'Failed to cancel assignment' };
  }
}

const carrierRequestSchema = z.object({
  yokomochiOrderId: z.string(),
  deliveryScheduleId: z.string().optional(),
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

    const { yokomochiOrderId, deliveryScheduleId, carrierCompanyId, notes } = parsed.data;

    const order = await prisma.yokomochiOrder.findUnique({
      where: { id: yokomochiOrderId },
      include: {
        factoryRequest: true,
        deliverySchedules: true,
        trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
        carrierRequests: { where: { status: CarrierRequestStatus.PENDING } },
      },
    });

    if (!order?.factoryRequest) return { success: false, error: 'Order not found' };
    if (order.factoryRequest.warehouseCompanyId !== session.user.companyId) {
      return { success: false, error: 'Unauthorized' };
    }

    const scheduleTrips = deliveryScheduleId
      ? order.trips.filter((t) => t.deliveryScheduleId === deliveryScheduleId)
      : order.trips;

    const eligible = getCarrierEligibleTrips(scheduleTrips);
    if (eligible.length === 0) {
      return { success: false, error: 'No remaining trips for external carrier on this date' };
    }

    const schedule = deliveryScheduleId
      ? order.deliverySchedules.find((s) => s.id === deliveryScheduleId)
      : null;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.carrierRequest.findFirst({
        where: {
          yokomochiOrderId,
          deliveryScheduleId: deliveryScheduleId ?? null,
          status: CarrierRequestStatus.PENDING,
        },
      });

      const payload = {
        warehouseCompanyId: session.user.companyId,
        carrierCompanyId,
        requestedTrips: eligible.length,
        deliveryDate: schedule?.deliveryDate ?? eligible[0]?.scheduledDate ?? null,
        notes,
        status: CarrierRequestStatus.PENDING,
      };

      if (existing) {
        await tx.carrierRequest.update({ where: { id: existing.id }, data: payload });
      } else {
        await tx.carrierRequest.create({
          data: {
            yokomochiOrderId,
            deliveryScheduleId: deliveryScheduleId ?? null,
            ...payload,
          },
        });
      }

      if (schedule) {
        await tx.deliverySchedule.update({
          where: { id: schedule.id },
          data: { status: 'CARRIER_PENDING' },
        });
      }

      await tx.yokomochiOrder.update({
        where: { id: yokomochiOrderId },
        data: { status: YokomochiOrderStatus.CARRIER_PENDING },
      });
    });

    await notifyYokomochiParties(yokomochiOrderId, {
      type: NotificationType.NEW_REQUEST,
      title: 'New carrier request',
      message: `${eligible.length} trip(s) requested from warehouse`,
      targets: { carrierCompanyId },
      metadata: { href: '/carrier/requests' },
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
  availableTrips: z.coerce.number().int().min(1),
  truckCount: z.coerce.number().int().min(1),
  driverCount: z.coerce.number().int().min(1),
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

    const scheduleTrips = request.deliveryScheduleId
      ? request.yokomochiOrder.trips.filter((t) => t.deliveryScheduleId === request.deliveryScheduleId)
      : request.yokomochiOrder.trips;
    const eligible = getCarrierEligibleTrips(scheduleTrips);

    if (data.availableTrips > 0 && eligible.length === 0) {
      return {
        success: false,
        error:
          'No carrier-eligible trips remain on this order. Ask the warehouse to release trips or send a new request.',
      };
    }

    const carrierTripCount = Math.min(data.availableTrips, eligible.length);

    if (data.availableTrips > 0 && carrierTripCount === 0) {
      return { success: false, error: 'No trips could be assigned to your fleet' };
    }

    if (data.availableTrips > eligible.length) {
      return {
        success: false,
        error: `Available trips cannot exceed ${eligible.length} (remaining after internal fleet)`,
      };
    }

    if (data.truckCount !== data.driverCount) {
      return { success: false, error: 'Truck count must equal driver count' };
    }

    if (data.availableTrips < 1) {
      return { success: false, error: 'Available trips must be at least 1' };
    }

    if (data.truckCount < 1) {
      return { success: false, error: 'At least 1 truck and driver required' };
    }

    const requestStatus =
      data.availableTrips === 0
        ? CarrierRequestStatus.REJECTED
        : carrierTripCount < eligible.length
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

      await tx.yokomochiOrder.update({
        where: { id: request.yokomochiOrderId },
        data: { status: YokomochiOrderStatus.CARRIER_PENDING },
      });
    });

    await notifyYokomochiParties(request.yokomochiOrderId, {
      type:
        requestStatus === CarrierRequestStatus.REJECTED
          ? NotificationType.ORDER_REJECTED
          : NotificationType.ORDER_ACCEPTED,
      title: 'Carrier response received',
      message:
        requestStatus === CarrierRequestStatus.REJECTED
          ? 'Carrier declined the request'
          : `Carrier accepted ${carrierTripCount} trip(s)`,
      targets: { warehouse: true },
      metadata: { href: '/warehouse/external-carrier' },
    });

    revalidatePath('/warehouse');
    revalidatePath('/carrier');
    revalidatePath('/carrier/requests');
    revalidatePath('/carrier/accepted');
    return {
      success: true,
      data: {
        acceptedTrips: carrierTripCount,
        eligibleTrips: eligible.length,
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

    const assignedDriver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });
    if (assignedDriver?.userId) {
      await notifyYokomochiParties(trip.yokomochiOrderId, {
        type: NotificationType.DRIVER_ASSIGNED,
        title: 'New delivery assigned',
        message: `Trip ${trip.tripCode} has been assigned to you`,
        targets: { driverUserId: assignedDriver.userId },
        metadata: { href: '/driver/active-job' },
      });
    }

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
      deliverySchedules: { orderBy: { deliveryDate: 'asc' } },
      trips: {
        orderBy: { tripNo: 'asc' },
        include: { internalFleetAssignment: { include: { driver: true, truck: true } } },
      },
      carrierRequests: { include: { response: true, carrierCompany: { select: { name: true } } } },
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
  const requests = await prisma.carrierRequest.findMany({
    where: { carrierCompanyId: session.user.companyId },
    include: {
      yokomochiOrder: {
        include: {
          factoryRequest: {
            include: { warehouseCompany: { select: { name: true } }, factoryCompany: { select: { name: true } } },
          },
          deliverySchedules: { orderBy: { deliveryDate: 'asc' } },
          trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
        },
      },
      response: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const req of requests) {
    if (req.status === CarrierRequestStatus.PENDING) {
      const scheduleTrips = req.deliveryScheduleId
        ? req.yokomochiOrder.trips.filter((t) => t.deliveryScheduleId === req.deliveryScheduleId)
        : req.yokomochiOrder.trips;
      const remaining = countRemainingCarrierTrips(scheduleTrips);
      if (remaining !== req.requestedTrips) {
        await prisma.carrierRequest.update({
          where: { id: req.id },
          data: { requestedTrips: remaining },
        });
        req.requestedTrips = remaining;
      }
    }
  }

  return requests;
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
          carrierRequests: { some: { carrierCompanyId: session.user.companyId } },
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
