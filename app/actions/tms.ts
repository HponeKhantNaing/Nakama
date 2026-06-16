'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  OrderStatus,
  NotificationType,
  CompanyType,
  DeliveryPriority,
  DriverStatus,
  SplitStatus,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { generateRequestNo } from '@/lib/utils';
import { emitNotificationEvent } from '@/lib/sse/emitter';
import { suggestTruckAssignment, planDeliverySplit } from '@/lib/tms/truck-assignment';
import { calculateRoute, resolveLocation, geocodeAddress } from '@/lib/tms/routing';
import { generateDeliveryToken, getTokenExpiry } from '@/lib/tms/qr-delivery';
import { estimateFuelLiters } from '@/lib/tms/gps';
import { ActionResult } from '@/types';

const deliveryItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
});

const createDeliverySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  warehouseId: z.string().optional(),
  deliveryDate: z.string().min(1),
  priority: z.nativeEnum(DeliveryPriority).default(DeliveryPriority.NORMAL),
  notes: z.string().optional(),
  items: z.array(deliveryItemSchema).min(1),
});

export async function createEnterpriseDelivery(
  input: z.infer<typeof createDeliverySchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF']);
    const parsed = createDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
    }

    const shinwa = await prisma.company.findFirst({ where: { type: CompanyType.SHINWA } });
    if (!shinwa) return { success: false, error: 'Shinwa company not configured' };

    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.items.map((i) => i.productId) } },
    });

    let totalWeight = 0;
    let totalVolume = 0;
    let totalQuantity = 0;
    let requiresRefrigerated = false;
    const itemRows: { productId: string; quantity: number; totalWeight: number; totalVolume: number }[] = [];

    for (const item of parsed.data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return { success: false, error: `Product not found: ${item.productId}` };
      const w = product.unitWeight * item.quantity;
      const v = product.unitVolume * item.quantity;
      totalWeight += w;
      totalVolume += v;
      totalQuantity += item.quantity;
      if (product.temperatureControlled) requiresRefrigerated = true;
      itemRows.push({ productId: product.id, quantity: item.quantity, totalWeight: w, totalVolume: v });
    }

    const truckPlan = suggestTruckAssignment(totalWeight, totalVolume, totalQuantity);
    const primaryTruck = truckPlan.assignments[0];

    const originCoords =
      (await geocodeAddress(parsed.data.origin)) ?? resolveLocation(parsed.data.origin);
    const destCoords =
      (await geocodeAddress(parsed.data.destination)) ?? resolveLocation(parsed.data.destination);
    const route = await calculateRoute(originCoords, destCoords);

    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.transportRequest.create({
        data: {
          requestNo: generateRequestNo(),
          origin: parsed.data.origin,
          destination: parsed.data.destination,
          cargoWeight: totalWeight,
          cargoVolume: totalVolume,
          totalQuantity,
          cargoType: products.map((p) => p.name).join(', '),
          expectedPickupDate: new Date(parsed.data.deliveryDate),
          deliveryDate: new Date(parsed.data.deliveryDate),
          priority: parsed.data.priority,
          notes: parsed.data.notes,
          creatorCompanyId: session.user.companyId,
          createdById: session.user.id,
          handlerCompanyId: shinwa.id,
          warehouseId: parsed.data.warehouseId,
          customerId: parsed.data.customerId,
          suggestedTruckType: primaryTruck?.truckType,
          suggestedTruckCount: truckPlan.assignments.reduce((s, a) => s + a.count, 0),
          estimatedCost: totalWeight * 50,
          originLat: originCoords.lat,
          originLng: originCoords.lng,
          destLat: destCoords.lat,
          destLng: destCoords.lng,
          routePolyline: route.polyline,
          routeDistanceKm: route.distanceKm,
          routeDurationMin: route.durationMin,
          eta: route.eta,
          fuelEstimateLiters: estimateFuelLiters(route.distanceKm, primaryTruck?.truckType),
        },
      });

      await tx.deliveryItem.createMany({
        data: itemRows.map((row) => ({ ...row, transportRequestId: req.id })),
      });

      return req;
    });

    await prisma.notification.create({
      data: {
        type: NotificationType.NEW_REQUEST,
        title: 'New Delivery Request',
        message: `${request.requestNo}: ${totalWeight}kg — suggested ${primaryTruck?.truckType ?? 'truck'}`,
        companyId: shinwa.id,
        transportRequestId: request.id,
        metadata: JSON.parse(JSON.stringify({ truckPlan, totalWeight, totalVolume })),
      },
    });

    await emitNotificationEvent(shinwa.id, {
      type: NotificationType.NEW_REQUEST,
      title: 'New Delivery Request',
      message: `Request ${request.requestNo} — ${totalWeight}kg`,
      data: { requestId: request.id, truckPlan },
    });

    revalidatePath('/maruichi');
    revalidatePath('/shinwa');

    return { success: true, data: { request, truckPlan, route } };
  } catch (error) {
    console.error('createEnterpriseDelivery:', error);
    return { success: false, error: 'Failed to create delivery' };
  }
}

export async function splitDelivery(
  requestId: string,
  carrierCapacityKg: number
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: { deliveryItems: { include: { product: true } } },
    });
    if (!request) return { success: false, error: 'Request not found' };

    const split = planDeliverySplit(
      request.cargoWeight,
      request.cargoVolume,
      carrierCapacityKg,
      request.totalQuantity ||
        request.deliveryItems.reduce((s, i) => s + i.quantity, 0)
    );

    const subcontractor = await prisma.company.findFirst({
      where: { type: CompanyType.SUBCONTRACTOR },
    });
    if (!subcontractor) return { success: false, error: 'No subcontractor configured' };

    await prisma.$transaction([
      prisma.transportRequest.update({
        where: { id: requestId },
        data: {
          status: OrderStatus.SPLIT,
          cargoWeight: split.internalWeightKg,
          cargoVolume: split.internalVolumeM3,
        },
      }),
      prisma.deliverySplit.create({
        data: {
          transportRequestId: requestId,
          companyId: session.user.companyId,
          assignedWeightKg: split.internalWeightKg,
          assignedVolumeM3: split.internalVolumeM3,
          status: SplitStatus.ASSIGNED,
        },
      }),
      prisma.deliverySplit.create({
        data: {
          transportRequestId: requestId,
          companyId: subcontractor.id,
          assignedWeightKg: split.subcontractWeightKg,
          assignedVolumeM3: split.subcontractVolumeM3,
          status: SplitStatus.PENDING,
        },
      }),
      prisma.subContractAssignment.upsert({
        where: { transportRequestId: requestId },
        create: {
          transportRequestId: requestId,
          subcontractorId: subcontractor.id,
          notes: `Split: ${split.subcontractWeightKg}kg forwarded`,
        },
        update: { subcontractorId: subcontractor.id },
      }),
    ]);

    await emitNotificationEvent(subcontractor.id, {
      type: NotificationType.DELIVERY_SPLIT,
      title: 'Split Delivery Assigned',
      message: `${split.subcontractWeightKg}kg assigned to your company`,
      data: { requestId },
    });

    revalidatePath('/shinwa');
    revalidatePath('/subcontractor');
    return { success: true, data: split };
  } catch (error) {
    console.error('splitDelivery:', error);
    return { success: false, error: 'Failed to split delivery' };
  }
}

export async function recordGpsPosition(
  latitude: number,
  longitude: number,
  speed?: number,
  heading?: number
): Promise<ActionResult> {
  try {
    const session = await requireRole(['DRIVER']);
    const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
    if (!driver) return { success: false, error: 'Driver not found' };

    const activeTrip = await prisma.tripAllocation.findFirst({
      where: {
        driverId: driver.id,
        transportRequest: {
          status: { in: [OrderStatus.DISPATCHED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
        },
      },
      include: { transportRequest: true },
    });

    await prisma.$transaction([
      prisma.gpsHistory.create({
        data: {
          driverId: driver.id,
          transportRequestId: activeTrip?.transportRequestId,
          latitude,
          longitude,
          speed,
          heading,
        },
      }),
      prisma.driver.update({
        where: { id: driver.id },
        data: {
          currentLat: latitude,
          currentLng: longitude,
          currentSpeed: speed,
          currentHeading: heading,
          lastLocationAt: new Date(),
          status: DriverStatus.DRIVING,
        },
      }),
    ]);

    if (activeTrip?.transportRequest) {
      const req = activeTrip.transportRequest;
      if (req.originLat && req.originLng && req.destLat && req.destLng) {
        const { calculateProgress } = await import('@/lib/tms/routing');
        const { percent } = calculateProgress(
          { lat: req.originLat, lng: req.originLng },
          { lat: req.destLat, lng: req.destLng },
          { lat: latitude, lng: longitude }
        );
        await prisma.transportRequest.update({
          where: { id: req.id },
          data: { progressPercent: percent, status: OrderStatus.IN_TRANSIT },
        });

        await emitNotificationEvent(req.creatorCompanyId, {
          type: NotificationType.GPS_UPDATE,
          title: 'Driver Location Updated',
          message: `${percent}% complete`,
          data: { requestId: req.id, lat: latitude, lng: longitude, percent },
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('recordGpsPosition:', error);
    return { success: false, error: 'Failed to record GPS' };
  }
}

export async function generateDeliveryQr(requestId: string): Promise<ActionResult> {
  try {
    await requireRole(['DRIVER']);
    const token = generateDeliveryToken();
    const confirmation = await prisma.deliveryConfirmation.upsert({
      where: { transportRequestId: requestId },
      create: {
        token,
        transportRequestId: requestId,
        expiresAt: getTokenExpiry(48),
      },
      update: {
        token,
        expiresAt: getTokenExpiry(48),
        qrGeneratedAt: new Date(),
      },
    });

    await prisma.transportRequest.update({
      where: { id: requestId },
      data: { status: OrderStatus.AWAITING_CONFIRMATION, arrivedAt: new Date() },
    });

    const { getQrPayload } = await import('@/lib/tms/qr-delivery');
    return { success: true, data: { token, url: getQrPayload(confirmation.token, '/confirm') } };
  } catch (error) {
    console.error('generateDeliveryQr:', error);
    return { success: false, error: 'Failed to generate QR' };
  }
}

export async function confirmDeliveryByCustomer(
  token: string,
  input: { approvedBy: string; notes?: string; customerIp?: string }
): Promise<ActionResult> {
  try {
    const confirmation = await prisma.deliveryConfirmation.findUnique({
      where: { token },
      include: { transportRequest: true },
    });

    if (!confirmation) return { success: false, error: 'Invalid confirmation token' };
    if (confirmation.expiresAt < new Date()) return { success: false, error: 'Token expired' };
    if (confirmation.approvedAt) return { success: false, error: 'Already confirmed' };

    await prisma.$transaction([
      prisma.deliveryConfirmation.update({
        where: { id: confirmation.id },
        data: {
          approvedAt: new Date(),
          approvedBy: input.approvedBy,
          customerIp: input.customerIp,
        },
      }),
      prisma.transportRequest.update({
        where: { id: confirmation.transportRequestId },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          onTime: confirmation.transportRequest.eta
            ? new Date() <= confirmation.transportRequest.eta
            : null,
        },
      }),
      prisma.proofOfDelivery.upsert({
        where: { transportRequestId: confirmation.transportRequestId },
        create: {
          transportRequestId: confirmation.transportRequestId,
          notes: input.notes,
        },
        update: { notes: input.notes },
      }),
    ]);

    await emitNotificationEvent(confirmation.transportRequest.creatorCompanyId, {
      type: NotificationType.CUSTOMER_CONFIRMED,
      title: 'Delivery Confirmed by Customer',
      message: `Order ${confirmation.transportRequest.requestNo} confirmed`,
      data: { requestId: confirmation.transportRequestId },
    });

    return { success: true };
  } catch (error) {
    console.error('confirmDeliveryByCustomer:', error);
    return { success: false, error: 'Confirmation failed' };
  }
}

export async function saveProofOfDelivery(
  requestId: string,
  data: { signatureUrl?: string; photoUrl?: string; notes?: string }
): Promise<ActionResult> {
  try {
    await prisma.proofOfDelivery.upsert({
      where: { transportRequestId: requestId },
      create: { transportRequestId: requestId, ...data },
      update: data,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to save proof of delivery' };
  }
}
