import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** SSE poll for new negotiation chat messages (warehouse ↔ factory). */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orderId = params.orderId;
  const since = req.nextUrl.searchParams.get('since') ?? undefined;

  const order = await prisma.yokomochiOrder.findUnique({
    where: { id: orderId },
    include: { factoryRequest: true },
  });

  if (!order?.factoryRequest) {
    return new Response('Not found', { status: 404 });
  }

  const allowed =
    session.user.role === UserRole.MARUICHI_STAFF
      ? order.factoryRequest.warehouseCompanyId === session.user.companyId
      : session.user.role === UserRole.FACTORY_STAFF &&
        order.factoryRequest.factoryCompanyId === session.user.companyId;

  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: 'CONNECTED', timestamp: new Date().toISOString() });

      let lastSince = since;

      while (!closed) {
        try {
          const messages = await prisma.negotiationChatMessage.findMany({
            where: {
              yokomochiOrderId: orderId,
              ...(lastSince ? { createdAt: { gt: new Date(lastSince) } } : {}),
            },
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
          });

          if (messages.length > 0) {
            lastSince = messages[messages.length - 1].createdAt.toISOString();
            send({ type: 'MESSAGES', messages });
          } else {
            send({ type: 'HEARTBEAT', timestamp: new Date().toISOString() });
          }
        } catch {
          send({ type: 'ERROR', message: 'poll failed' });
        }

        await new Promise((r) => setTimeout(r, 2500));
      }
    },
    cancel() {
      closed = true;
    },
  });

  req.signal.addEventListener('abort', () => {
    closed = true;
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
