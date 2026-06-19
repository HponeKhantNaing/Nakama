'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole, resolveSessionUserId } from '@/lib/session';
import type { ActionResult } from '@/types';

const sendMessageSchema = z.object({
  yokomochiOrderId: z.string(),
  message: z.string().min(1).max(2000),
});

export async function getNegotiationChatMessages(yokomochiOrderId: string, since?: string) {
  const session = await requireRole(['MARUICHI_STAFF', 'FACTORY_STAFF']);

  const order = await prisma.yokomochiOrder.findUnique({
    where: { id: yokomochiOrderId },
    include: { factoryRequest: true },
  });

  if (!order?.factoryRequest) return [];

  const allowed =
    session.user.role === UserRole.MARUICHI_STAFF
      ? order.factoryRequest.warehouseCompanyId === session.user.companyId
      : order.factoryRequest.factoryCompanyId === session.user.companyId;

  if (!allowed) return [];

  return prisma.negotiationChatMessage.findMany({
    where: {
      yokomochiOrderId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    include: {
      sender: { select: { id: true, name: true, role: true, companyId: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: since ? 100 : 200,
  });
}

export async function factoryMaySubmitResponse(yokomochiOrderId: string): Promise<{ ok: boolean; error?: string }> {
  const warehouseMsg = await prisma.negotiationChatMessage.findFirst({
    where: { yokomochiOrderId, senderRole: UserRole.MARUICHI_STAFF },
  });

  if (!warehouseMsg) {
    return { ok: false, error: 'Warehouse request message not found' };
  }

  const lastRenegotiation = await prisma.negotiationHistory.findFirst({
    where: { yokomochiOrderId, action: 'REQUEST_AGAIN' },
    orderBy: { createdAt: 'desc' },
  });

  const factoryMsg = await prisma.negotiationChatMessage.findFirst({
    where: {
      yokomochiOrderId,
      senderRole: UserRole.FACTORY_STAFF,
      ...(lastRenegotiation ? { createdAt: { gt: lastRenegotiation.createdAt } } : {}),
    },
  });

  if (!factoryMsg) {
    return {
      ok: false,
      error: lastRenegotiation
        ? 'Reply in chat about the revised request before updating availability'
        : 'Chat with the warehouse before submitting availability (boxes / dates)',
    };
  }

  return { ok: true };
}

export async function sendNegotiationChatMessage(
  input: z.infer<typeof sendMessageSchema>
): Promise<ActionResult> {
  try {
    const session = await requireRole(['MARUICHI_STAFF', 'FACTORY_STAFF']);
    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid message' };

    const order = await prisma.yokomochiOrder.findUnique({
      where: { id: parsed.data.yokomochiOrderId },
      include: { factoryRequest: true },
    });

    if (!order?.factoryRequest) return { success: false, error: 'Order not found' };

    const allowed =
      session.user.role === UserRole.MARUICHI_STAFF
        ? order.factoryRequest.warehouseCompanyId === session.user.companyId
        : order.factoryRequest.factoryCompanyId === session.user.companyId;

    if (!allowed) return { success: false, error: 'Unauthorized' };

    const userId = await resolveSessionUserId(session);
    if (!userId) return { success: false, error: 'User not found' };

    await prisma.negotiationChatMessage.create({
      data: {
        yokomochiOrderId: parsed.data.yokomochiOrderId,
        senderUserId: userId,
        senderRole: session.user.role as UserRole,
        senderCompanyId: session.user.companyId,
        message: parsed.data.message.trim(),
      },
    });

    revalidatePath('/warehouse/negotiations');
    revalidatePath('/factory/requests');
    return { success: true };
  } catch (e) {
    console.error('sendNegotiationChatMessage:', e);
    return { success: false, error: 'Failed to send message' };
  }
}
