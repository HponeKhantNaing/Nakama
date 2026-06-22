import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function notificationScope(session: { user: { id: string; companyId: string } }) {
  return {
    OR: [{ userId: session.user.id }, { companyId: session.user.companyId }],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const where = notificationScope(session);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { ...where, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const scope = notificationScope(session);

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { ...scope, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id, ...scope },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
