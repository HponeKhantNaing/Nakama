'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  OrderStatus,
  NotificationType,
  CompanyType,
  DriverStatus,
  TruckStatus,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { generateRequestNo } from '@/lib/utils';
import { emitNotificationEvent } from '@/lib/sse/emitter';
import { createNotification } from '@/lib/notifications';
import { ActionResult } from '@/types';
import {
  getLocationById,
  locationLabel,
  estimateWeightFromBoxes,
  DEFAULT_BOX_WEIGHT_KG,
} from '@/lib/tms/locations';
import { calculateRoute } from '@/lib/tms/routing';

const createRequestSchema = z.object({
  originLocationId: z.string().min(1, 'Origin is required'),
  destinationLocationId: z.string().min(1, 'Destination is required'),
  cargoType: z.string().min(1, 'Cargo type is required'),
  totalBoxes: z.coerce.number().int().positive('Box count must be at least 1'),
  expectedPickupDate: z.string().min(1, 'Pickup date is required'),
  notes: z.string().optional(),
});

export async function createTransportRequest(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);

    const parsed = createRequestSchema.safeParse({
      originLocationId: formData.get('originLocationId'),
      destinationLocationId: formData.get('destinationLocationId'),
      cargoType: formData.get('cargoType'),
      totalBoxes: formData.get('totalBoxes'),
      expectedPickupDate: formData.get('expectedPickupDate'),
      notes: formData.get('notes'),
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
    }

    const originLoc = getLocationById(parsed.data.originLocationId);
    const destLoc = getLocationById(parsed.data.destinationLocationId);
    if (!originLoc || !destLoc) {
      return { success: false, error: 'Invalid origin or destination' };
    }
    if (originLoc.id === destLoc.id) {
      return { success: false, error: 'Origin and destination must be different' };
    }

    const shinwa = await prisma.company.findFirst({
      where: { type: CompanyType.SHINWA },
    });

    if (!shinwa) {
      return { success: false, error: 'Shinwa company not configured' };
    }

    // Demo reset: keep one "working" shipment at a time.
    // When Maruichi creates a new request, remove any previous in-progress requests created today
    // and reset carrier/subcontractor fleet availability.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const requestsToClear = await prisma.transportRequest.findMany({
      where: {
        creatorCompanyId: session.user.companyId,
        createdAt: { gte: todayStart },
      },
      select: { id: true },
    });

    const requestIdsToClear = requestsToClear.map((r) => r.id);

    if (requestIdsToClear.length > 0) {
      const carrierCompanies = await prisma.company.findMany({
        where: { type: { in: [CompanyType.SHINWA, CompanyType.SUBCONTRACTOR] } },
        select: { id: true },
      });

      const companyIds = carrierCompanies.map((c) => c.id);

      await prisma.$transaction([
        prisma.gpsHistory.deleteMany({
          where: { transportRequestId: { in: requestIdsToClear } },
        }),
        prisma.transportRequest.deleteMany({
          where: { id: { in: requestIdsToClear } },
        }),
        prisma.driver.updateMany({
          where: { companyId: { in: companyIds } },
          data: {
            isAvailable: true,
            status: DriverStatus.AVAILABLE,
            currentLat: null,
            currentLng: null,
            currentHeading: null,
            currentSpeed: null,
            lastLocationAt: null,
          },
        }),
        prisma.truck.updateMany({
          where: { companyId: { in: companyIds } },
          data: { status: TruckStatus.AVAILABLE },
        }),
        prisma.vehicle.updateMany({
          where: { companyId: { in: companyIds } },
          data: { isAvailable: true },
        }),
      ]);
    }

    const totalBoxes = parsed.data.totalBoxes;
    const cargoWeight = estimateWeightFromBoxes(totalBoxes);
    const originCoords = { lat: originLoc.lat, lng: originLoc.lng };
    const destCoords = { lat: destLoc.lat, lng: destLoc.lng };
    const route = await calculateRoute(originCoords, destCoords);

    const request = await prisma.transportRequest.create({
      data: {
        requestNo: generateRequestNo(),
        origin: locationLabel(originLoc, 'ja'),
        destination: locationLabel(destLoc, 'ja'),
        cargoType: parsed.data.cargoType,
        cargoWeight,
        totalQuantity: totalBoxes,
        cargoVolume: totalBoxes * 0.02,
        expectedPickupDate: new Date(parsed.data.expectedPickupDate),
        notes: parsed.data.notes,
        creatorCompanyId: session.user.companyId,
        createdById: session.user.id,
        handlerCompanyId: shinwa.id,
        estimatedCost: cargoWeight * 50,
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
        routePolyline: route.polyline,
        routeDistanceKm: route.distanceKm,
        routeDurationMin: route.durationMin,
        eta: route.eta,
      },
    });

    await prisma.notification.create({
      data: {
        type: NotificationType.NEW_REQUEST,
        title: 'New Transport Request',
        message: `New transport request ${request.requestNo} received from ${session.user.companyName}`,
        companyId: shinwa.id,
        transportRequestId: request.id,
      },
    });

    await emitNotificationEvent(shinwa.id, {
      type: NotificationType.NEW_REQUEST,
      title: 'New Transport Request Received',
      message: `Request ${request.requestNo}: ${totalBoxes} boxes — ${locationLabel(originLoc, 'ja')} → ${locationLabel(destLoc, 'ja')}`,
      data: {
        requestId: request.id,
        requestNo: request.requestNo,
        totalBoxes,
        estimatedWeightKg: cargoWeight,
      },
    });

    revalidatePath('/maruichi');
    revalidatePath('/shinwa');

    return { success: true, data: request };
  } catch (error) {
    console.error('createTransportRequest error:', error);
    return { success: false, error: 'Failed to create transport request' };
  }
}

export async function acceptOrder(requestId: string): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);

    const availableTruckCount = await prisma.truck.count({
      where: { companyId: session.user.companyId, status: TruckStatus.AVAILABLE },
    });

    if (availableTruckCount <= 0) {
      return { success: false, error: 'No available trucks for allocation' };
    }

    const request = await prisma.transportRequest.update({
      where: { id: requestId, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.SHINWA_ACCEPTED,
        handlerCompanyId: session.user.companyId,
      },
      include: { creatorCompany: true },
    });

    await prisma.notification.create({
      data: {
        type: NotificationType.ORDER_ACCEPTED,
        title: 'Order Accepted',
        message: `Request ${request.requestNo} has been accepted by Shinwa`,
        companyId: request.creatorCompanyId,
        transportRequestId: request.id,
      },
    });

    await emitNotificationEvent(request.creatorCompanyId, {
      type: NotificationType.ORDER_ACCEPTED,
      title: 'Order Accepted',
      message: `Your request ${request.requestNo} has been accepted`,
      data: { requestId: request.id },
    });

    revalidatePath('/shinwa');
    revalidatePath('/maruichi');

    return { success: true, data: request };
  } catch (error) {
    console.error('acceptOrder error:', error);
    return { success: false, error: 'Failed to accept order' };
  }
}

export async function rejectOrder(requestId: string): Promise<ActionResult> {
  try {
    await requireRole(['SHINWA_STAFF']);

    const request = await prisma.transportRequest.update({
      where: { id: requestId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });

    await prisma.notification.create({
      data: {
        type: NotificationType.ORDER_REJECTED,
        title: 'Order Rejected',
        message: `Request ${request.requestNo} has been rejected`,
        companyId: request.creatorCompanyId,
        transportRequestId: request.id,
      },
    });

    await emitNotificationEvent(request.creatorCompanyId, {
      type: NotificationType.ORDER_REJECTED,
      title: 'Order Rejected',
      message: `Your request ${request.requestNo} has been rejected`,
      data: { requestId: request.id },
    });

    revalidatePath('/shinwa');
    revalidatePath('/maruichi');

    return { success: true, data: request };
  } catch (error) {
    console.error('rejectOrder error:', error);
    return { success: false, error: 'Failed to reject order' };
  }
}

const assignFleetSchema = z.object({
  requestId: z.string(),
  driverId: z.string(),
  vehicleId: z.string().optional(),
  truckId: z.string().optional(),
});

export async function assignFleet(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);

    const parsed = assignFleetSchema.safeParse({
      requestId: formData.get('requestId'),
      driverId: formData.get('driverId'),
      vehicleId: formData.get('vehicleId') || undefined,
      truckId: formData.get('truckId') || undefined,
    });

    if (!parsed.success) {
      return { success: false, error: 'Invalid fleet assignment data' };
    }

    const { requestId, driverId, vehicleId, truckId } = parsed.data;
    if (!vehicleId && !truckId) {
      return { success: false, error: 'Truck or vehicle required' };
    }

    const [request, trip] = await prisma.$transaction([
      prisma.transportRequest.update({
        where: {
          id: requestId,
          status: { in: [OrderStatus.PENDING, OrderStatus.SHINWA_ACCEPTED] },
        },
        data: {
          status: OrderStatus.DRIVER_ASSIGNED,
          handlerCompanyId: session.user.companyId,
        },
      }),
      prisma.tripAllocation.create({
        data: {
          transportRequestId: requestId,
          driverId,
          vehicleId: vehicleId ?? null,
          truckId: truckId ?? null,
        },
      }),
      prisma.driver.update({
        where: { id: driverId },
        data: { isAvailable: false, status: DriverStatus.DRIVING },
      }),
      ...(vehicleId
        ? [
            prisma.vehicle.update({
              where: { id: vehicleId },
              data: { isAvailable: false },
            }),
          ]
        : []),
      ...(truckId
        ? [
            prisma.truck.update({
              where: { id: truckId },
              data: { status: TruckStatus.IN_USE },
            }),
          ]
        : []),
    ]);

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });

    if (driver?.userId) {
      await createNotification({
        type: NotificationType.DRIVER_ASSIGNED,
        title: 'New Job Assigned',
        message: `You have been assigned to request ${request.requestNo}`,
        userId: driver.userId,
        transportRequestId: requestId,
        metadata: { href: '/driver/active-job', requestId },
      });
    }

    await emitNotificationEvent(request.creatorCompanyId, {
      type: NotificationType.DRIVER_ASSIGNED,
      title: 'Driver Assigned',
      message: `Driver assigned to request ${request.requestNo}`,
      data: { requestId },
    });

    revalidatePath('/shinwa');
    revalidatePath('/driver');
    revalidatePath('/maruichi');

    return { success: true, data: trip };
  } catch (error) {
    console.error('assignFleet error:', error);
    return { success: false, error: 'Failed to assign fleet' };
  }
}

const forwardSchema = z.object({
  requestId: z.string(),
  subcontractorId: z.string(),
  notes: z.string().optional(),
});

export async function forwardToSubcontractor(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);

    const parsed = forwardSchema.safeParse({
      requestId: formData.get('requestId'),
      subcontractorId: formData.get('subcontractorId'),
      notes: formData.get('notes'),
    });

    if (!parsed.success) {
      return { success: false, error: 'Invalid subcontract data' };
    }

    const { requestId, subcontractorId, notes } = parsed.data;

    const [request] = await prisma.$transaction([
      prisma.transportRequest.update({
        where: { id: requestId },
        data: {
          status: OrderStatus.SUBCONTRACTED,
          handlerCompanyId: subcontractorId,
        },
      }),
      prisma.subContractAssignment.create({
        data: { transportRequestId: requestId, subcontractorId, notes },
      }),
    ]);

    await prisma.notification.create({
      data: {
        type: NotificationType.SUBCONTRACT_ASSIGNED,
        title: 'Subcontract Assignment',
        message: `Request ${request.requestNo} forwarded to subcontractor`,
        companyId: subcontractorId,
        transportRequestId: requestId,
      },
    });

    await emitNotificationEvent(subcontractorId, {
      type: NotificationType.SUBCONTRACT_ASSIGNED,
      title: 'New Subcontract Order',
      message: `Request ${request.requestNo} assigned to your company`,
      data: { requestId },
    });

    revalidatePath('/shinwa');
    revalidatePath('/subcontractor');

    return { success: true, data: request };
  } catch (error) {
    console.error('forwardToSubcontractor error:', error);
    return { success: false, error: 'Failed to forward to subcontractor' };
  }
}

export async function subcontractorAssignFleet(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SUBCONTRACTOR_STAFF']);

    const parsed = assignFleetSchema.safeParse({
      requestId: formData.get('requestId'),
      driverId: formData.get('driverId'),
      vehicleId: formData.get('vehicleId'),
    });

    if (!parsed.success) {
      return { success: false, error: 'Invalid assignment data' };
    }

    const { requestId, driverId, vehicleId } = parsed.data;

    const assignment = await prisma.subContractAssignment.findFirst({
      where: {
        transportRequestId: requestId,
        subcontractorId: session.user.companyId,
      },
    });

    if (!assignment) {
      return { success: false, error: 'Order not assigned to your company' };
    }

    await prisma.$transaction([
      prisma.transportRequest.update({
        where: { id: requestId },
        data: { status: OrderStatus.DRIVER_ASSIGNED },
      }),
      prisma.tripAllocation.create({
        data: { transportRequestId: requestId, driverId, vehicleId },
      }),
      prisma.driver.update({
        where: { id: driverId },
        data: { isAvailable: false },
      }),
      prisma.vehicle.update({
        where: { id: vehicleId },
        data: { isAvailable: false },
      }),
    ]);

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (driver?.userId) {
      await createNotification({
        type: NotificationType.DRIVER_ASSIGNED,
        title: 'New Job Assigned',
        message: 'You have been assigned to a delivery job',
        userId: driver.userId,
        transportRequestId: requestId,
        metadata: { href: '/driver/active-job', requestId },
      });
    }

    revalidatePath('/subcontractor');
    revalidatePath('/driver');

    return { success: true };
  } catch (error) {
    console.error('subcontractorAssignFleet error:', error);
    return { success: false, error: 'Failed to assign fleet' };
  }
}

export async function updateDeliveryStatus(
  requestId: string,
  status: 'DISPATCHED' | 'PICKED_UP' | 'ARRIVED' | 'DELIVERED'
): Promise<ActionResult> {
  try {
    const session = await requireRole(['DRIVER']);

    const driver = await prisma.driver.findFirst({
      where: { userId: session.user.id },
    });

    if (!driver) {
      return { success: false, error: 'Driver profile not found' };
    }

    const trip = await prisma.tripAllocation.findFirst({
      where: {
        transportRequestId: requestId,
        driverId: driver.id,
      },
      include: {
        transportRequest: { include: { creatorCompany: true } },
      },
    });

    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status: OrderStatus[status] };

    if (status === 'DISPATCHED') {
      await prisma.tripAllocation.update({
        where: { id: trip.id },
        data: { dispatchedAt: now },
      });
      await emitNotificationEvent(trip.transportRequest.creatorCompanyId, {
        type: NotificationType.STATUS_UPDATE,
        title: 'Dispatched',
        message: `Request ${trip.transportRequest.requestNo} dispatched`,
        data: { requestId },
      });
    } else if (status === 'PICKED_UP') {
      await prisma.tripAllocation.update({
        where: { id: trip.id },
        data: { pickedUpAt: now },
      });
      await emitNotificationEvent(trip.transportRequest.creatorCompanyId, {
        type: NotificationType.STATUS_UPDATE,
        title: 'Picked Up',
        message: `Request ${trip.transportRequest.requestNo} picked up`,
        data: { requestId },
      });
    } else if (status === 'ARRIVED') {
      updateData.arrivedAt = now;
      await prisma.transportRequest.update({
        where: { id: requestId },
        data: { arrivedAt: now, status: OrderStatus.ARRIVED },
      });
      await emitNotificationEvent(trip.transportRequest.creatorCompanyId, {
        type: NotificationType.ARRIVED_AT_DESTINATION,
        title: 'Arrived at Destination',
        message: `Request ${trip.transportRequest.requestNo} has arrived`,
        data: { requestId },
      });
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = now;
      await prisma.tripAllocation.update({
        where: { id: trip.id },
        data: { deliveredAt: now },
      });
      await prisma.driver.update({
        where: { id: driver.id },
        data: { isAvailable: true, status: DriverStatus.AVAILABLE },
      });
      if (trip.vehicleId) {
        await prisma.vehicle.update({
          where: { id: trip.vehicleId },
          data: { isAvailable: true },
        });
      }
      if (trip.truckId) {
        await prisma.truck.update({
          where: { id: trip.truckId },
          data: { status: TruckStatus.AVAILABLE },
        });
      }

      await prisma.notification.create({
        data: {
          type: NotificationType.DELIVERY_COMPLETE,
          title: 'Delivery Complete',
          message: `Request ${trip.transportRequest.requestNo} has been delivered`,
          companyId: trip.transportRequest.creatorCompanyId,
          transportRequestId: requestId,
        },
      });

      await emitNotificationEvent(trip.transportRequest.creatorCompanyId, {
        type: NotificationType.DELIVERY_COMPLETE,
        title: 'Delivery Complete',
        message: `Request ${trip.transportRequest.requestNo} delivered successfully`,
        data: { requestId },
      });
    }

    const request = await prisma.transportRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    revalidatePath('/driver');
    revalidatePath('/maruichi');
    revalidatePath('/shinwa');
    revalidatePath('/subcontractor');

    return { success: true, data: request };
  } catch (error) {
    console.error('updateDeliveryStatus error:', error);
    return { success: false, error: 'Failed to update delivery status' };
  }
}

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [
          { userId: session.user.id },
          { companyId: session.user.companyId },
        ],
      },
      data: { isRead: true },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to mark notification as read' };
  }
}
