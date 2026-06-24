import { UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function assertNegotiationChatAccess(
  orderId: string,
  session: {
    user: { role: string; companyId: string };
  }
) {
  const order = await prisma.yokomochiOrder.findUnique({
    where: { id: orderId },
    include: { factoryRequest: true },
  });

  if (!order?.factoryRequest) {
    return { ok: false as const, status: 404, error: 'Order not found' };
  }

  const allowed =
    session.user.role === UserRole.MARUICHI_STAFF
      ? order.factoryRequest.warehouseCompanyId === session.user.companyId
      : session.user.role === UserRole.FACTORY_STAFF &&
        order.factoryRequest.factoryCompanyId === session.user.companyId;

  if (!allowed) {
    return { ok: false as const, status: 403, error: 'Unauthorized' };
  }

  return { ok: true as const, order };
}
