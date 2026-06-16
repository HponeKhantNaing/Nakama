import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sseManager } from '@/lib/sse';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addClient({
        id: clientId,
        companyId: session.user.companyId,
        userId: session.user.id,
        controller,
        encoder,
      });

      const welcome = {
        type: 'HEARTBEAT' as const,
        title: 'Connected',
        message: 'SSE connection established',
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcome)}\n\n`));
    },
    cancel() {
      sseManager.removeClient(clientId);
    },
  });

  req.signal.addEventListener('abort', () => {
    sseManager.removeClient(clientId);
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
