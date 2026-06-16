'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AssignmentStatus,
  NotificationType,
  OrderStatus,
  TruckStatus,
  DriverStatus,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { emitNotificationEvent } from '@/lib/sse/emitter';
import { autoAllocateTrucks } from '@/lib/tms/auto-allocation';
import { suggestTruckAssignment } from '@/lib/tms/truck-assignment';
import { generateDeliveryToken, getTokenExpiry } from '@/lib/tms/qr-delivery';
import { computeRequestStatus, calculateRequestProgress, canCancelAssignment, calculateAllocationRemaining } from '@/lib/tms/request-compute';
import { ActionResult } from '@/types';

export async function getAutoAllocationPlan(requestId: string): Promise<ActionResult> {
  try {
    await requireRole(['SHINWA_STAFF']);
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: { deliveryItems: true },
    });
    if (!request) return { success: false, error: 'Request not found' };

    const session = await requireRole(['SHINWA_STAFF']);
    const trucks = await prisma.truck.findMany({
      where: { companyId: session.user.companyId, status: TruckStatus.AVAILABLE },
    });

    const totalQty =
      request.totalQuantity ||
      request.deliveryItems.reduce((s, i) => s + i.quantity, 0);

    const result = autoAllocateTrucks(
      {
        totalWeight: request.cargoWeight,
        totalQuantity: totalQty,
        totalVolume: request.cargoVolume,
      },
      trucks.map((t) => ({
        id: t.id,
        truckNo: t.truckNo ?? t.truckNumber,
        truckType: t.truckType,
        capacityWeightKg: t.capacityWeightKg,
        capacityVolumeM3: t.capacityVolumeM3,
        maxBoxes: t.maxBoxes,
        status: t.status,
      }))
    );

    const typePlan = suggestTruckAssignment(
      request.cargoWeight,
      request.cargoVolume,
      totalQty
    );

    return { success: true, data: { ...result, typePlan } };
  } catch (error) {
    console.error('getAutoAllocationPlan:', error);
    return { success: false, error: 'Failed to compute allocation' };
  }
}

const manualAssignmentSchema = z.object({
  requestId: z.string(),
  truckId: z.string(),
  driverId: z.string(),
  assignedWeight: z.coerce.number().positive(),
  assignedQuantity: z.coerce.number().int().min(0),
});

export async function createTruckAssignment(
  input: z.infer<typeof manualAssignmentSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF', 'SUBCONTRACTOR_STAFF']);
    const parsed = manualAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: 'Invalid assignment data' };
    }

    const { requestId, truckId, driverId, assignedWeight, assignedQuantity } = parsed.data;

    const assignment = await prisma.$transaction(async (tx) => {
      const request = await tx.transportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, requestNo: true, cargoWeight: true, totalQuantity: true, status: true },
      });
      if (!request) throw new Error('Request not found');

      const truck = await tx.truck.findUnique({
        where: { id: truckId },
        select: { id: true, status: true, maxBoxes: true, capacityWeightKg: true },
      });
      if (!truck) throw new Error('Truck not found');
      if (truck.status !== TruckStatus.AVAILABLE) {
        throw new Error('Truck is not available');
      }

      const driver = await tx.driver.findUnique({
        where: { id: driverId },
        select: { id: true, isAvailable: true },
      });
      if (!driver) throw new Error('Driver not found');
      if (!driver.isAvailable) {
        throw new Error('Driver is not available');
      }

      const duplicateDriver = await tx.truckAssignment.findFirst({
        where: {
          transportRequestId: requestId,
          driverId,
          status: { not: AssignmentStatus.CANCELLED },
        },
      });
      if (duplicateDriver) {
        throw new Error('This driver already has an active assignment on this request');
      }

      const duplicateTruck = await tx.truckAssignment.findFirst({
        where: {
          transportRequestId: requestId,
          truckId,
          status: { not: AssignmentStatus.CANCELLED },
        },
      });
      if (duplicateTruck) {
        throw new Error('This truck already has an active assignment on this request');
      }

      const sums = await tx.truckAssignment.aggregate({
        where: {
          transportRequestId: requestId,
          status: { not: AssignmentStatus.CANCELLED },
        },
        _sum: { assignedQuantity: true, assignedWeight: true },
        _count: true,
      });

      const alreadyAssignedQty = sums._sum.assignedQuantity ?? 0;
      const alreadyAssignedWeight = sums._sum.assignedWeight ?? 0;
      const remainingQty = Math.max(0, (request.totalQuantity ?? 0) - alreadyAssignedQty);
      const remainingWeight = Math.max(0, (request.cargoWeight ?? 0) - alreadyAssignedWeight);

      if (remainingQty <= 0 && remainingWeight <= 0) {
        throw new Error('This request is already fully assigned');
      }

      if (assignedQuantity <= 0) {
        throw new Error('Assigned boxes must be greater than 0');
      }
      if (assignedQuantity > remainingQty) {
        throw new Error(`Assigned boxes exceed remaining (${remainingQty})`);
      }
      if (assignedQuantity > (truck.maxBoxes ?? 0)) {
        throw new Error(`Truck cannot carry ${assignedQuantity} boxes (max ${truck.maxBoxes})`);
      }
      if (assignedWeight > remainingWeight) {
        throw new Error(`Assigned weight exceeds remaining (${remainingWeight} kg)`);
      }
      if (assignedWeight > (truck.capacityWeightKg ?? 0)) {
        throw new Error(`Truck cannot carry ${assignedWeight} kg (max ${truck.capacityWeightKg} kg)`);
      }

      const created = await tx.truckAssignment.create({
        data: {
          transportRequestId: requestId,
          truckId,
          driverId,
          assignedWeight,
          assignedQuantity,
          status: AssignmentStatus.ASSIGNED,
        },
        include: { truck: true, driver: true },
      });

      await tx.truck.update({ where: { id: truckId }, data: { status: TruckStatus.IN_USE } });
      await tx.driver.update({
        where: { id: driverId },
        data: { isAvailable: false, status: DriverStatus.DRIVING },
      });

      await recomputeRequestAfterAssignmentChange(tx, requestId);

      return created;
    });

    const request = await prisma.transportRequest.findUnique({ where: { id: requestId } });

    await emitNotificationEvent(session.user.companyId, {
      type: NotificationType.TRUCK_ASSIGNED,
      title: 'Truck Assigned',
      message: `Truck assigned to ${request?.requestNo}`,
      data: { requestId, assignmentId: assignment.id },
    });

    await emitNotificationEvent(session.user.companyId, {
      type: NotificationType.DRIVER_ASSIGNED,
      title: 'Driver Assigned',
      message: `Driver assigned to ${request?.requestNo}`,
      data: { requestId, assignmentId: assignment.id },
    });

    revalidatePath('/shinwa');
    revalidatePath('/subcontractor');
    revalidatePath('/driver');
    revalidatePath('/maruichi');

    return { success: true, data: assignment };
  } catch (error) {
    console.error('createTruckAssignment:', error);
    return { success: false, error: 'Failed to create assignment' };
  }
}

export async function autoAssignFleet(requestId: string): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF']);

    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        truckAssignments: {
          select: { status: true, assignedWeight: true, assignedQuantity: true },
        },
      },
    });
    if (!request) return { success: false, error: 'Request not found' };

    const allocation = calculateAllocationRemaining({
      totalWeight: request.cargoWeight,
      totalQuantity: request.totalQuantity,
      assignments: request.truckAssignments,
    });
    if (allocation.isFullyAllocated) {
      return { success: false, error: 'Request is already fully assigned' };
    }

    const planResult = await getAutoAllocationPlan(requestId);
    if (!planResult.success || !planResult.data) {
      return { success: false, error: planResult.error ?? 'Allocation failed' };
    }

    const plan = planResult.data as {
      allocations: { truckId: string; assignedWeight: number; assignedQuantity: number }[];
      requiresSubcontract: boolean;
    };

    if (plan.allocations.length === 0) {
      return { success: false, error: 'No available trucks' };
    }

    const drivers = await prisma.driver.findMany({
      where: { companyId: session.user.companyId, isAvailable: true },
      take: plan.allocations.length,
    });

    if (drivers.length < plan.allocations.length) {
      return {
        success: false,
        error: `Need ${plan.allocations.length} drivers, only ${drivers.length} available`,
      };
    }

    const assignments = [];
    for (let i = 0; i < plan.allocations.length; i++) {
      const slot = plan.allocations[i];
      const result = await createTruckAssignment({
        requestId,
        truckId: slot.truckId,
        driverId: drivers[i].id,
        assignedWeight: slot.assignedWeight,
        assignedQuantity: slot.assignedQuantity,
      });
      if (!result.success) return result;
      assignments.push(result.data);
    }

    return {
      success: true,
      data: { assignments, requiresSubcontract: plan.requiresSubcontract },
    };
  } catch (error) {
    console.error('autoAssignFleet:', error);
    return { success: false, error: 'Auto assignment failed' };
  }
}

async function releaseAssignmentResources(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  assignment: { id: string; truckId: string | null; driverId: string | null }
) {
  if (assignment.truckId) {
    const otherTruckUse = await tx.truckAssignment.count({
      where: {
        truckId: assignment.truckId,
        id: { not: assignment.id },
        status: { not: AssignmentStatus.CANCELLED },
      },
    });
    if (otherTruckUse === 0) {
      await tx.truck.update({
        where: { id: assignment.truckId },
        data: { status: TruckStatus.AVAILABLE },
      });
    }
  }
  if (assignment.driverId) {
    const otherDriverUse = await tx.truckAssignment.count({
      where: {
        driverId: assignment.driverId,
        id: { not: assignment.id },
        status: {
          in: [
            AssignmentStatus.ASSIGNED,
            AssignmentStatus.DISPATCHED,
            AssignmentStatus.PICKED_UP,
            AssignmentStatus.IN_TRANSIT,
            AssignmentStatus.ARRIVED,
          ],
        },
      },
    });
    if (otherDriverUse === 0) {
      await tx.driver.update({
        where: { id: assignment.driverId },
        data: { isAvailable: true, status: DriverStatus.AVAILABLE },
      });
    }
  }
}

async function recomputeRequestAfterAssignmentChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  requestId: string
) {
  const request = await tx.transportRequest.findUnique({
    where: { id: requestId },
    select: { id: true, cargoWeight: true, totalQuantity: true, status: true },
  });
  if (!request) throw new Error('Request not found');

  const all = await tx.truckAssignment.findMany({
    where: { transportRequestId: requestId },
    select: {
      status: true,
      assignedWeight: true,
      assignedQuantity: true,
      assignmentConfirmation: { select: { approved: true } },
    },
  });

  const nextStatus = computeRequestStatus({
    requestStatus: request.status,
    assignments: all,
    totalQuantity: request.totalQuantity,
    totalWeight: request.cargoWeight,
  });
  const nextProgress = calculateRequestProgress({
    totalWeight: request.cargoWeight,
    assignments: all,
  });

  await tx.transportRequest.update({
    where: { id: requestId },
    data: {
      status: nextStatus,
      progressPercent: nextProgress,
      ...(nextStatus === OrderStatus.DELIVERED
        ? { deliveredAt: new Date() }
        : { deliveredAt: null }),
    },
  });
}

export async function cancelTruckAssignment(assignmentId: string): Promise<ActionResult> {
  try {
    const session = await requireRole(['SHINWA_STAFF', 'SUBCONTRACTOR_STAFF']);

    await prisma.$transaction(async (tx) => {
      const assignment = await tx.truckAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          transportRequest: { select: { id: true, handlerCompanyId: true, requestNo: true } },
          assignmentConfirmation: { select: { approved: true } },
        },
      });
      if (!assignment) throw new Error('Assignment not found');
      if (assignment.transportRequest.handlerCompanyId !== session.user.companyId) {
        throw new Error('Not authorized');
      }
      if (!canCancelAssignment(assignment)) {
        throw new Error('Cannot cancel: driver has already confirmed or trip has started');
      }

      await tx.truckAssignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.CANCELLED },
      });

      await releaseAssignmentResources(tx, assignment);
      await recomputeRequestAfterAssignmentChange(tx, assignment.transportRequestId);
    });

    await emitNotificationEvent(session.user.companyId, {
      type: NotificationType.STATUS_UPDATE,
      title: 'Assignment Cancelled',
      message: 'A truck assignment was cancelled before driver confirmation',
      data: { assignmentId },
    });

    revalidatePath('/shinwa');
    revalidatePath('/subcontractor');
    revalidatePath('/driver');
    revalidatePath('/maruichi');

    return { success: true };
  } catch (error) {
    console.error('cancelTruckAssignment:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel assignment';
    return { success: false, error: message };
  }
}

export async function rejectTruckAssignment(assignmentId: string): Promise<ActionResult> {
  try {
    const session = await requireRole(['DRIVER']);
    const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
    if (!driver) return { success: false, error: 'Driver not found' };

    await prisma.$transaction(async (tx) => {
      const assignment = await tx.truckAssignment.findFirst({
        where: { id: assignmentId, driverId: driver.id },
        include: {
          transportRequest: { select: { id: true, requestNo: true, handlerCompanyId: true } },
          assignmentConfirmation: { select: { approved: true } },
        },
      });
      if (!assignment) throw new Error('Assignment not found');
      if (!canCancelAssignment(assignment)) {
        throw new Error('Cannot reject: trip has already started or customer confirmed');
      }

      await tx.truckAssignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.CANCELLED },
      });

      await releaseAssignmentResources(tx, assignment);
      await recomputeRequestAfterAssignmentChange(tx, assignment.transportRequestId);
    });

    const assignment = await prisma.truckAssignment.findUnique({
      where: { id: assignmentId },
      select: { transportRequest: { select: { handlerCompanyId: true, requestNo: true } } },
    });
    if (assignment?.transportRequest.handlerCompanyId) {
      await emitNotificationEvent(assignment.transportRequest.handlerCompanyId, {
        type: NotificationType.STATUS_UPDATE,
        title: 'Driver Rejected Assignment',
        message: `${assignment.transportRequest.requestNo}: driver rejected before trip start`,
        data: { assignmentId },
      });
    }

    revalidatePath('/driver');
    revalidatePath('/shinwa');
    revalidatePath('/maruichi');

    return { success: true };
  } catch (error) {
    console.error('rejectTruckAssignment:', error);
    const message = error instanceof Error ? error.message : 'Failed to reject assignment';
    return { success: false, error: message };
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: 'DISPATCHED' | 'PICKED_UP' | 'ARRIVED' | 'DELIVERED'
): Promise<ActionResult> {
  try {
    const session = await requireRole(['DRIVER']);
    const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
    if (!driver) return { success: false, error: 'Driver not found' };

    const assignment = await prisma.truckAssignment.findFirst({
      where: { id: assignmentId, driverId: driver.id },
      include: { transportRequest: true, truck: true },
    });
    if (!assignment) return { success: false, error: 'Assignment not found' };

    const now = new Date();
    const statusMap = {
      DISPATCHED: AssignmentStatus.DISPATCHED,
      PICKED_UP: AssignmentStatus.PICKED_UP,
      ARRIVED: AssignmentStatus.ARRIVED,
      DELIVERED: AssignmentStatus.DELIVERED,
    } as const;

    await prisma.$transaction(async (tx) => {
      await tx.truckAssignment.update({
        where: { id: assignmentId },
        data: {
          status: statusMap[status],
          ...(status === 'DISPATCHED' && { dispatchedAt: now }),
          ...(status === 'PICKED_UP' && { pickedUpAt: now }),
          ...(status === 'ARRIVED' && { arrivedAt: now }),
          ...(status === 'DELIVERED' && { deliveredAt: now }),
        },
      });

      const request = await tx.transportRequest.findUnique({
        where: { id: assignment.transportRequestId },
        select: { id: true, cargoWeight: true, totalQuantity: true, status: true },
      });
      if (!request) throw new Error('Request not found');

      // Recompute parent status/progress from ALL assignments (business rule)
      const all = await tx.truckAssignment.findMany({
        where: { transportRequestId: assignment.transportRequestId },
        select: {
          status: true,
          assignedWeight: true,
          assignedQuantity: true,
          assignmentConfirmation: { select: { approved: true } },
        },
      });

      const nextStatus = computeRequestStatus({
        requestStatus: request.status,
        assignments: all,
        totalQuantity: request.totalQuantity,
        totalWeight: request.cargoWeight,
      });

      const nextProgress = calculateRequestProgress({
        totalWeight: request.cargoWeight,
        assignments: all,
      });

      const active = all.filter((a) => a.status !== AssignmentStatus.CANCELLED);
      const allArrivedOrDelivered =
        active.length > 0 &&
        active.every((a) =>
          [AssignmentStatus.ARRIVED, AssignmentStatus.DELIVERED].includes(a.status)
        );

      await tx.transportRequest.update({
        where: { id: assignment.transportRequestId },
        data: {
          status: nextStatus,
          progressPercent: nextProgress,
          ...(allArrivedOrDelivered && { arrivedAt: now }),
          ...(nextStatus === OrderStatus.DELIVERED
            ? { deliveredAt: now }
            : { deliveredAt: null }),
        },
      });

      if (status === 'DELIVERED' && assignment.truckId) {
        await tx.truck.update({
          where: { id: assignment.truckId },
          data: { status: TruckStatus.AVAILABLE },
        });
        await tx.driver.update({
          where: { id: driver.id },
          data: { isAvailable: true, status: DriverStatus.AVAILABLE },
        });
      }
    });

    const eventType =
      status === 'DISPATCHED'
        ? NotificationType.STATUS_UPDATE
        : status === 'PICKED_UP'
          ? NotificationType.STATUS_UPDATE
          : status === 'ARRIVED'
            ? NotificationType.ARRIVED_AT_DESTINATION
            : NotificationType.DELIVERY_COMPLETE;

    await emitNotificationEvent(assignment.transportRequest.creatorCompanyId, {
      type: eventType,
      title: `Delivery ${status.replace('_', ' ')}`,
      message: `${assignment.transportRequest.requestNo}: ${status}`,
      data: { requestId: assignment.transportRequestId, assignmentId },
    });

    revalidatePath('/driver');
    revalidatePath('/maruichi');
    revalidatePath('/shinwa');

    return { success: true };
  } catch (error) {
    console.error('updateAssignmentStatus:', error);
    return { success: false, error: 'Failed to update status' };
  }
}

export async function recordAssignmentProgress(
  assignmentId: string,
  data: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    progress?: number;
    etaMinutes?: number;
  }
): Promise<ActionResult> {
  try {
    await requireRole(['DRIVER', 'SHINWA_STAFF', 'MARUICHI_STAFF']);

    await prisma.deliveryProgress.create({
      data: {
        assignmentId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        progress: data.progress ?? 0,
        etaMinutes: data.etaMinutes,
      },
    });

    const assignment = await prisma.truckAssignment.findUnique({
      where: { id: assignmentId },
      include: { transportRequest: true, driver: true },
    });

    if (assignment?.driverId) {
      await prisma.driver.update({
        where: { id: assignment.driverId },
        data: {
          currentLat: data.latitude,
          currentLng: data.longitude,
          currentSpeed: data.speed,
          currentHeading: data.heading,
          lastLocationAt: new Date(),
        },
      });
    }

    if (assignment?.transportRequest) {
      const progress = data.progress ?? 0;
      let nextStatus = OrderStatus.IN_TRANSIT;
      if (progress >= 100) nextStatus = OrderStatus.ARRIVED;
      else if (progress < 5) nextStatus = OrderStatus.DISPATCHED;
      else if (progress < 15) nextStatus = OrderStatus.PICKED_UP;

      await prisma.transportRequest.update({
        where: { id: assignment.transportRequestId },
        data: {
          progressPercent: progress,
          status: nextStatus,
        },
      });

      await emitNotificationEvent(assignment.transportRequest.creatorCompanyId, {
        type: NotificationType.GPS_UPDATE,
        title: 'Live Tracking Update',
        message: `${assignment.transportRequest.requestNo}: ${data.progress?.toFixed(0)}%`,
        data: {
          requestId: assignment.transportRequestId,
          assignmentId,
          lat: data.latitude,
          lng: data.longitude,
          progress: data.progress,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('recordAssignmentProgress:', error);
    return { success: false, error: 'Failed to record progress' };
  }
}

export async function generateAssignmentQr(assignmentId: string): Promise<ActionResult> {
  try {
    await requireRole(['DRIVER']);
    const token = generateDeliveryToken();

    const confirmation = await prisma.assignmentConfirmation.upsert({
      where: { assignmentId },
      create: {
        assignmentId,
        qrToken: token,
        expiresAt: getTokenExpiry(48),
      },
      update: {
        qrToken: token,
        expiresAt: getTokenExpiry(48),
      },
      include: { assignment: { include: { transportRequest: true } } },
    });

    await prisma.transportRequest.update({
      where: { id: confirmation.assignment.transportRequestId },
      data: { status: OrderStatus.AWAITING_CONFIRMATION },
    });

    const { getQrPayload } = await import('@/lib/tms/qr-delivery');
    return { success: true, data: { token, url: getQrPayload(token, '/confirm') } };
  } catch (error) {
    console.error('generateAssignmentQr:', error);
    return { success: false, error: 'Failed to generate QR' };
  }
}

export async function confirmAssignmentByCustomer(
  token: string,
  input: { approvedBy: string; customerIp?: string }
): Promise<ActionResult> {
  try {
    const confirmation = await prisma.assignmentConfirmation.findUnique({
      where: { qrToken: token },
      include: {
        assignment: {
          include: { transportRequest: true, truck: true, driver: true },
        },
      },
    });

    if (!confirmation) return { success: false, error: 'Invalid confirmation token' };
    if (confirmation.expiresAt < new Date()) return { success: false, error: 'Token expired' };
    if (confirmation.approved) return { success: false, error: 'Already confirmed' };

    await prisma.$transaction([
      prisma.assignmentConfirmation.update({
        where: { id: confirmation.id },
        data: {
          approved: true,
          approvedAt: new Date(),
          approvedBy: input.approvedBy,
          customerIp: input.customerIp,
        },
      }),
      prisma.truckAssignment.update({
        where: { id: confirmation.assignmentId },
        data: { status: AssignmentStatus.DELIVERED, deliveredAt: new Date() },
      }),
    ]);

    // Recompute parent request status/progress from ALL assignments after confirmation
    const req = await prisma.transportRequest.findUnique({
      where: { id: confirmation.assignment.transportRequestId },
      select: { id: true, cargoWeight: true, totalQuantity: true, status: true },
    });
    if (req) {
      const all = await prisma.truckAssignment.findMany({
        where: { transportRequestId: req.id },
        select: {
          status: true,
          assignedWeight: true,
          assignedQuantity: true,
          assignmentConfirmation: { select: { approved: true } },
        },
      });
      const nextStatus = computeRequestStatus({
        requestStatus: req.status,
        assignments: all,
        totalQuantity: req.totalQuantity,
        totalWeight: req.cargoWeight,
      });
      const nextProgress = calculateRequestProgress({ totalWeight: req.cargoWeight, assignments: all });
      await prisma.transportRequest.update({
        where: { id: req.id },
        data: {
          status: nextStatus,
          progressPercent: nextProgress,
          ...(nextStatus === OrderStatus.DELIVERED
            ? { deliveredAt: new Date() }
            : { deliveredAt: null }),
        },
      });
    }

    await emitNotificationEvent(confirmation.assignment.transportRequest.creatorCompanyId, {
      type: NotificationType.CUSTOMER_CONFIRMED,
      title: 'Customer Approved Delivery',
      message: `Order ${confirmation.assignment.transportRequest.requestNo} confirmed`,
      data: { requestId: confirmation.assignment.transportRequestId },
    });

    return { success: true };
  } catch (error) {
    console.error('confirmAssignmentByCustomer:', error);
    return { success: false, error: 'Confirmation failed' };
  }
}
