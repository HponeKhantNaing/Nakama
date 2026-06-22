import { NotificationType, type Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { emitNotificationEvent, emitUserNotificationEvent } from '@/lib/sse/emitter';

export type NotificationMetadata = {
  href?: string;
  orderId?: string;
  orderNo?: string;
  requestId?: string;
  tripId?: string;
  [key: string]: unknown;
};

type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  companyId?: string | null;
  userId?: string | null;
  transportRequestId?: string | null;
  metadata?: NotificationMetadata;
};

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      companyId: input.companyId ?? undefined,
      userId: input.userId ?? undefined,
      transportRequestId: input.transportRequestId ?? undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  const ssePayload = {
    type: input.type,
    title: input.title,
    message: input.message,
    data: {
      notificationId: notification.id,
      ...(input.metadata ?? {}),
    },
  };

  if (input.companyId) {
    await emitNotificationEvent(input.companyId, ssePayload);
  }
  if (input.userId) {
    await emitUserNotificationEvent(input.userId, ssePayload);
  }

  return notification;
}

export async function getYokomochiOrderParties(orderId: string) {
  const order = await prisma.yokomochiOrder.findUnique({
    where: { id: orderId },
    include: { factoryRequest: true },
  });
  if (!order?.factoryRequest) return null;
  return {
    orderNo: order.orderNo,
    warehouseCompanyId: order.factoryRequest.warehouseCompanyId,
    factoryCompanyId: order.factoryRequest.factoryCompanyId,
  };
}

type YokomochiNotifyTargets = {
  warehouse?: boolean;
  factory?: boolean;
  driverUserId?: string;
  carrierCompanyId?: string;
};

export async function notifyYokomochiParties(
  orderId: string,
  input: {
    type: NotificationType;
    title: string;
    message: string;
    metadata?: NotificationMetadata;
    targets: YokomochiNotifyTargets;
  }
) {
  const parties = await getYokomochiOrderParties(orderId);
  if (!parties) return;

  const baseMetadata: NotificationMetadata = {
    orderId,
    orderNo: parties.orderNo,
    ...input.metadata,
  };

  const tasks: Promise<unknown>[] = [];

  if (input.targets.warehouse) {
    tasks.push(
      createNotification({
        type: input.type,
        title: input.title,
        message: input.message,
        companyId: parties.warehouseCompanyId,
        metadata: {
          ...baseMetadata,
          href: baseMetadata.href ?? '/warehouse/factory-requests',
        },
      })
    );
  }

  if (input.targets.factory) {
    tasks.push(
      createNotification({
        type: input.type,
        title: input.title,
        message: input.message,
        companyId: parties.factoryCompanyId,
        metadata: {
          ...baseMetadata,
          href: baseMetadata.href ?? '/factory/requests',
        },
      })
    );
  }

  if (input.targets.carrierCompanyId) {
    tasks.push(
      createNotification({
        type: input.type,
        title: input.title,
        message: input.message,
        companyId: input.targets.carrierCompanyId,
        metadata: {
          ...baseMetadata,
          href: baseMetadata.href ?? '/carrier/requests',
        },
      })
    );
  }

  if (input.targets.driverUserId) {
    tasks.push(
      createNotification({
        type: input.type,
        title: input.title,
        message: input.message,
        userId: input.targets.driverUserId,
        metadata: {
          ...baseMetadata,
          href: baseMetadata.href ?? '/driver/active-job',
        },
      })
    );
  }

  await Promise.all(tasks);
}
