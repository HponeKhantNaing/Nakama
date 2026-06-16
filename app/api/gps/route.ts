import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isValidGpsPing } from '@/lib/tms/gps';
import { recordGpsPosition } from '@/app/actions/tms';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!isValidGpsPing(body)) {
    return NextResponse.json({ error: 'Invalid GPS coordinates' }, { status: 400 });
  }

  const result = await recordGpsPosition(
    body.latitude,
    body.longitude,
    body.speed,
    body.heading
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const driverId = searchParams.get('driverId');

  if (!requestId && !driverId) {
    return NextResponse.json({ error: 'requestId or driverId required' }, { status: 400 });
  }

  const driver = driverId
    ? await prisma.driver.findUnique({ where: { id: driverId } })
    : null;

  const history = await prisma.gpsHistory.findMany({
    where: {
      ...(requestId ? { transportRequestId: requestId } : {}),
      ...(driverId ? { driverId } : {}),
    },
    orderBy: { recordedAt: 'asc' },
    take: 500,
  });

  return NextResponse.json({
    current: driver
      ? {
          lat: driver.currentLat,
          lng: driver.currentLng,
          speed: driver.currentSpeed,
          heading: driver.currentHeading,
          updatedAt: driver.lastLocationAt,
        }
      : null,
    history,
  });
}
