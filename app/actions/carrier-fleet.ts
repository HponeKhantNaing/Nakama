'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
  DriverStatus,
  LicenseType,
  TruckStatus,
  TruckType,
  UserRole,
  YokomochiTripStatus,
  YokomochiOrderStatus,
  CarrierRequestStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import type { ActionResult } from '@/types';
import {
  getYokomochiBoxCapacity,
  getYokomochiPalletCapacity,
} from '@/lib/yokomochi/vehicle-capacity';
import { getCarrierEligibleTrips } from '@/lib/yokomochi/carrier-allocation';

const createDriverSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  licenseNo: z.string().optional(),
  licenseType: z.nativeEnum(LicenseType).default(LicenseType.STANDARD),
});

const createTruckSchema = z.object({
  truckNumber: z.string().min(1),
  truckNo: z.string().optional(),
  plateNumber: z.string().min(1),
  truckType: z.nativeEnum(TruckType),
  capacityWeightKg: z.coerce.number().positive().optional(),
  capacityVolumeM3: z.coerce.number().positive().optional(),
});

const allocationRowSchema = z.object({
  truckId: z.string(),
  driverId: z.string(),
  deliveryTimes: z.coerce.number().int().min(1).max(20),
});

const applyAllocationSchema = z.object({
  orderId: z.string(),
  rows: z.array(allocationRowSchema).min(1),
});

const DEFAULT_WEIGHT: Record<TruckType, number> = {
  TEN_TON: 10000,
  MEDIUM: 4000,
  SMALL: 2500,
  BANN: 350,
};

const DEFAULT_VOLUME: Record<TruckType, number> = {
  TEN_TON: 40,
  MEDIUM: 16,
  SMALL: 8,
  BANN: 2,
};

export async function getCarrierFleetDirectory() {
  const session = await requireRole(['SHINWA_STAFF']);
  const [drivers, trucks] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: 'asc' },
      include: { user: { select: { email: true } } },
    }),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);
  return { drivers, trucks };
}

export async function createCarrierDriver(
  input: z.infer<typeof createDriverSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const parsed = createDriverSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid driver data' };

    const { name, email, password, phone, licenseNo, licenseType } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return { success: false, error: 'Email is already registered' };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const driver = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name,
          role: UserRole.DRIVER,
          companyId: session.user.companyId,
        },
      });

      return tx.driver.create({
        data: {
          name,
          phone: phone || null,
          licenseNo: licenseNo || null,
          licenseType,
          companyId: session.user.companyId,
          userId: user.id,
          status: DriverStatus.AVAILABLE,
          isAvailable: true,
        },
      });
    });

    revalidatePath('/carrier/fleet');
    revalidatePath('/carrier/accepted');
    return { success: true, data: { id: driver.id } };
  } catch (e) {
    console.error('createCarrierDriver:', e);
    return { success: false, error: 'Failed to create driver' };
  }
}

export async function createCarrierTruck(
  input: z.infer<typeof createTruckSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const parsed = createTruckSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid vehicle data' };

    const { truckType, truckNumber, truckNo, plateNumber, capacityWeightKg, capacityVolumeM3 } =
      parsed.data;

    const truck = await prisma.truck.create({
      data: {
        truckNumber,
        truckNo: truckNo || truckNumber,
        plateNumber,
        truckType,
        capacityWeightKg: capacityWeightKg ?? DEFAULT_WEIGHT[truckType],
        capacityVolumeM3: capacityVolumeM3 ?? DEFAULT_VOLUME[truckType],
        maxBoxes: getYokomochiBoxCapacity(truckType),
        maxPallet: getYokomochiPalletCapacity(truckType),
        status: TruckStatus.AVAILABLE,
        companyId: session.user.companyId,
      },
    });

    revalidatePath('/carrier/fleet');
    revalidatePath('/carrier/accepted');
    return { success: true, data: { id: truck.id } };
  } catch (e) {
    console.error('createCarrierTruck:', e);
    return { success: false, error: 'Failed to create vehicle. Check plate/truck numbers are unique.' };
  }
}

export type CarrierAcceptedJobGroup = {
  orderId: string;
  orderNo: string;
  cargoType: string | null;
  totalRequestedBoxes: number;
  assignedBoxes: number;
  acceptedAt: Date | null;
  trips: {
    id: string;
    tripNo: number;
    tripCode: string;
    pallets: number;
    boxes: number;
    status: string;
    driverTask?: {
      status: string;
      pickupLocation: string;
      destination: string;
      cargoType: string | null;
      createdAt: Date;
      driver: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
      };
      truck: {
        id: string;
        truckNo: string | null;
        plateNumber: string;
        truckType: TruckType;
      } | null;
    } | null;
  }[];
};

async function syncCarrierTripsForAcceptedRequests(companyId: string) {
  const requests = await prisma.carrierRequest.findMany({
    where: {
      carrierCompanyId: companyId,
      status: { in: [CarrierRequestStatus.ACCEPTED, CarrierRequestStatus.PARTIAL] },
      response: { availableTrips: { gt: 0 } },
    },
    include: {
      response: true,
      yokomochiOrder: {
        include: {
          trips: { include: { internalFleetAssignment: true, subcontractAssignment: true } },
        },
      },
    },
  });

  for (const request of requests) {
    if (!request.response) continue;

    const assignedCount = request.yokomochiOrder.trips.filter(
      (trip) =>
        trip.carrierCompanyId === companyId &&
        (trip.status === YokomochiTripStatus.CARRIER_ASSIGNED ||
          trip.status === YokomochiTripStatus.DRIVER_ASSIGNED)
    ).length;

    const targetCount = Math.min(request.response.availableTrips, request.requestedTrips);
    const remaining = targetCount - assignedCount;
    if (remaining <= 0) continue;

    const eligible = getCarrierEligibleTrips(request.yokomochiOrder.trips);
    const toAssign = eligible.slice(0, remaining);
    if (toAssign.length === 0) continue;

    await prisma.yokomochiTrip.updateMany({
      where: { id: { in: toAssign.map((trip) => trip.id) } },
      data: {
        status: YokomochiTripStatus.CARRIER_ASSIGNED,
        carrierCompanyId: companyId,
      },
    });
  }
}

function mapTripToGroupTrip(
  trip: {
    id: string;
    tripNo: number;
    tripCode: string;
    pallets: number;
    boxes: number;
    status: string;
    driverTask?: {
      status: string;
      pickupLocation: string;
      destination: string;
      cargoType: string | null;
      createdAt: Date;
      driver: {
        id: string;
        name: string;
        phone: string | null;
        user?: { email: string | null } | null;
      };
      truck: {
        id: string;
        truckNo: string | null;
        plateNumber: string;
        truckType: TruckType;
      } | null;
    } | null;
  }
) {
  return {
    id: trip.id,
    tripNo: trip.tripNo,
    tripCode: trip.tripCode,
    pallets: trip.pallets,
    boxes: trip.boxes,
    status: trip.status,
    driverTask: trip.driverTask
      ? {
          status: trip.driverTask.status,
          pickupLocation: trip.driverTask.pickupLocation,
          destination: trip.driverTask.destination,
          cargoType: trip.driverTask.cargoType,
          createdAt: trip.driverTask.createdAt,
          driver: {
            id: trip.driverTask.driver.id,
            name: trip.driverTask.driver.name,
            phone: trip.driverTask.driver.phone,
            email: trip.driverTask.driver.user?.email ?? null,
          },
          truck: trip.driverTask.truck
            ? {
                id: trip.driverTask.truck.id,
                truckNo: trip.driverTask.truck.truckNo,
                plateNumber: trip.driverTask.truck.plateNumber,
                truckType: trip.driverTask.truck.truckType,
              }
            : null,
        }
      : null,
  };
}

export async function getCarrierAcceptedJobGroups(): Promise<CarrierAcceptedJobGroup[]> {
  const session = await requireRole(['SHINWA_STAFF']);
  const companyId = session.user.companyId;

  await syncCarrierTripsForAcceptedRequests(companyId);

  const acceptedRequests = await prisma.carrierRequest.findMany({
    where: {
      carrierCompanyId: companyId,
      status: { in: [CarrierRequestStatus.ACCEPTED, CarrierRequestStatus.PARTIAL] },
      response: { availableTrips: { gt: 0 } },
    },
    include: {
      response: true,
      yokomochiOrder: {
        select: {
          id: true,
          orderNo: true,
          cargoType: true,
          factoryRequest: { select: { cargoType: true, requestedBoxes: true } },
          trips: {
            where: {
              carrierCompanyId: companyId,
              status: {
                in: [YokomochiTripStatus.CARRIER_ASSIGNED, YokomochiTripStatus.DRIVER_ASSIGNED],
              },
            },
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
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const groups: CarrierAcceptedJobGroup[] = [];

  for (const request of acceptedRequests) {
    const order = request.yokomochiOrder;
    if (order.trips.length === 0) continue;

    const cargoType =
      order.cargoType ?? order.factoryRequest?.cargoType ?? 'キーコーヒー飲料';

    let totalRequestedBoxes = 0;
    let assignedBoxes = 0;
    const trips = order.trips.map((trip) => {
      totalRequestedBoxes += trip.boxes;
      if (trip.status === YokomochiTripStatus.DRIVER_ASSIGNED) {
        assignedBoxes += trip.boxes;
      }
      return mapTripToGroupTrip(trip);
    });

    groups.push({
      orderId: order.id,
      orderNo: order.orderNo,
      cargoType,
      totalRequestedBoxes,
      assignedBoxes,
      acceptedAt: request.response?.respondedAt ?? request.updatedAt,
      trips,
    });
  }

  groups.sort((a, b) => {
    const aTime = a.acceptedAt?.getTime() ?? 0;
    const bTime = b.acceptedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return groups;
}

export async function applyCarrierFleetAllocation(
  input: z.infer<typeof applyAllocationSchema>
): Promise<ActionResult<{ assignedTrips: number }>> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const parsed = applyAllocationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid allocation data' };

    const { orderId, rows } = parsed.data;

    const pendingTrips = await prisma.yokomochiTrip.findMany({
      where: {
        yokomochiOrderId: orderId,
        carrierCompanyId: session.user.companyId,
        status: YokomochiTripStatus.CARRIER_ASSIGNED,
      },
      include: { yokomochiOrder: true },
      orderBy: { tripNo: 'asc' },
    });

    if (pendingTrips.length === 0) {
      return { success: false, error: 'No trips awaiting driver assignment' };
    }

    const trucks = await prisma.truck.findMany({
      where: { id: { in: rows.map((r) => r.truckId) }, companyId: session.user.companyId },
    });
    const drivers = await prisma.driver.findMany({
      where: { id: { in: rows.map((r) => r.driverId) }, companyId: session.user.companyId },
    });

    const truckMap = new Map(trucks.map((t) => [t.id, t]));
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    type Slot = { truckId: string; driverId: string; boxes: number };
    const slots: Slot[] = [];

    for (const row of rows) {
      const truck = truckMap.get(row.truckId);
      const driver = driverMap.get(row.driverId);
      if (!truck || !driver) {
        return { success: false, error: 'Invalid truck or driver in allocation' };
      }
      if (truck.status !== TruckStatus.AVAILABLE) {
        return {
          success: false,
          error: `Truck ${truck.truckNo ?? truck.truckNumber} is not available`,
        };
      }
      if (!driver.isAvailable) {
        return { success: false, error: `Driver ${driver.name} is not available` };
      }

      const boxesPerRound = getYokomochiBoxCapacity(truck.truckType);
      for (let i = 0; i < row.deliveryTimes; i++) {
        slots.push({
          truckId: row.truckId,
          driverId: row.driverId,
          boxes: boxesPerRound,
        });
      }
    }

    const totalPendingBoxes = pendingTrips.reduce((sum, t) => sum + t.boxes, 0);
    const totalAllocatedBoxes = slots.reduce((sum, s) => sum + s.boxes, 0);

    if (totalAllocatedBoxes < totalPendingBoxes) {
      return {
        success: false,
        error: `Insufficient capacity: ${totalAllocatedBoxes} boxes allocated but ${totalPendingBoxes} required`,
      };
    }

    const mergedSlots: Slot[] = [];
    const slotMergeMap = new Map<string, Slot>();
    for (const slot of slots) {
      const key = `${slot.driverId}:${slot.truckId}`;
      const existing = slotMergeMap.get(key);
      if (existing) {
        existing.boxes += slot.boxes;
      } else {
        const merged = { ...slot };
        slotMergeMap.set(key, merged);
        mergedSlots.push(merged);
      }
    }

    type TripChunk = {
      id: string;
      orderNo: string;
      boxes: number;
      pallets: number;
      cargoType: string | null;
    };

    const splitPallets = (totalPallets: number, totalBoxes: number, assignBoxes: number) => {
      if (assignBoxes >= totalBoxes) return totalPallets;
      return Math.max(1, Math.round((totalPallets * assignBoxes) / totalBoxes));
    };

    let assignedCount = 0;
    const usedTrucks = new Set<string>();
    const usedDrivers = new Set<string>();

    await prisma.$transaction(async (tx) => {
      const order = pendingTrips[0].yokomochiOrder;
      const chunks: TripChunk[] = pendingTrips.map((trip) => ({
        id: trip.id,
        orderNo: order.orderNo,
        boxes: trip.boxes,
        pallets: trip.pallets,
        cargoType: order.cargoType,
      }));

      let nextTripNo =
        pendingTrips.reduce((max, trip) => Math.max(max, trip.tripNo), 0) + 1;
      let createdTrips = 0;

      const markFleetInUse = async (slot: Slot) => {
        if (!usedTrucks.has(slot.truckId)) {
          await tx.truck.update({
            where: { id: slot.truckId },
            data: { status: TruckStatus.IN_USE },
          });
          usedTrucks.add(slot.truckId);
        }
        if (!usedDrivers.has(slot.driverId)) {
          await tx.driver.update({
            where: { id: slot.driverId },
            data: { isAvailable: false, status: DriverStatus.DRIVING },
          });
          usedDrivers.add(slot.driverId);
        }
      };

      const createDriverTask = async (
        tripId: string,
        slot: Slot,
        assignBoxes: number,
        assignPallets: number,
        cargoType: string | null
      ) => {
        await tx.driverTask.upsert({
          where: { tripId },
          create: {
            tripId,
            driverId: slot.driverId,
            truckId: slot.truckId,
            pickupLocation: '飲料工場',
            destination: '20号物流センター',
            cargoType,
            boxes: assignBoxes,
            pallets: assignPallets,
          },
          update: {
            driverId: slot.driverId,
            truckId: slot.truckId,
            boxes: assignBoxes,
            pallets: assignPallets,
          },
        });
        await markFleetInUse(slot);
        assignedCount += 1;
      };

      for (const slot of mergedSlots) {
        let slotCapacity = slot.boxes;

        while (slotCapacity > 0) {
          const chunkIndex = chunks.findIndex((chunk) => chunk.boxes > 0);
          if (chunkIndex === -1) break;

          const chunk = chunks[chunkIndex];
          const assignBoxes = Math.min(slotCapacity, chunk.boxes);
          const assignPallets = splitPallets(chunk.pallets, chunk.boxes, assignBoxes);

          if (assignBoxes === chunk.boxes) {
            await tx.yokomochiTrip.update({
              where: { id: chunk.id },
              data: {
                status: YokomochiTripStatus.DRIVER_ASSIGNED,
                boxes: assignBoxes,
                pallets: assignPallets,
              },
            });
            await createDriverTask(chunk.id, slot, assignBoxes, assignPallets, chunk.cargoType);
            chunk.boxes = 0;
            chunk.pallets = 0;
          } else {
            const remainderBoxes = chunk.boxes - assignBoxes;
            const remainderPallets = chunk.pallets - assignPallets;
            const newTripCode = `${chunk.orderNo}-T${nextTripNo}`;

            const assignedTrip = await tx.yokomochiTrip.create({
              data: {
                yokomochiOrderId: orderId,
                tripNo: nextTripNo,
                tripCode: newTripCode,
                boxes: assignBoxes,
                pallets: assignPallets,
                status: YokomochiTripStatus.DRIVER_ASSIGNED,
                carrierCompanyId: session.user.companyId,
              },
            });
            nextTripNo += 1;
            createdTrips += 1;

            await createDriverTask(
              assignedTrip.id,
              slot,
              assignBoxes,
              assignPallets,
              chunk.cargoType
            );

            if (remainderBoxes === 0) {
              await tx.yokomochiTrip.delete({ where: { id: chunk.id } });
              chunks.splice(chunkIndex, 1);
            } else {
              await tx.yokomochiTrip.update({
                where: { id: chunk.id },
                data: { boxes: remainderBoxes, pallets: remainderPallets },
              });
              chunk.boxes = remainderBoxes;
              chunk.pallets = remainderPallets;
            }
          }

          slotCapacity -= assignBoxes;
        }
      }

      if (createdTrips > 0) {
        await tx.yokomochiOrder.update({
          where: { id: orderId },
          data: { totalTrips: { increment: createdTrips } },
        });
      }

      const orderTrips = await tx.yokomochiTrip.count({
        where: {
          yokomochiOrderId: orderId,
          carrierCompanyId: session.user.companyId,
          status: YokomochiTripStatus.CARRIER_ASSIGNED,
        },
      });

      if (orderTrips === 0) {
        await tx.yokomochiOrder.update({
          where: { id: orderId },
          data: { status: YokomochiOrderStatus.DRIVER_ASSIGNED },
        });
      }
    });

    revalidatePath('/carrier');
    revalidatePath('/carrier/accepted');
    revalidatePath('/driver');
    return { success: true, data: { assignedTrips: assignedCount } };
  } catch (e) {
    console.error('applyCarrierFleetAllocation:', e);
    return { success: false, error: 'Failed to apply fleet allocation' };
  }
}
