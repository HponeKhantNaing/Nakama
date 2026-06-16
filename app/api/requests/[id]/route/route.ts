import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureRequestRoute } from '@/lib/tms/route-utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const request = await prisma.transportRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      originLat: true,
      originLng: true,
      destLat: true,
      destLng: true,
      routePolyline: true,
      routeDistanceKm: true,
      routeDurationMin: true,
    },
  });

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const origin = {
    lat: request.originLat ?? 35.6762,
    lng: request.originLng ?? 139.6503,
  };
  const destination = {
    lat: request.destLat ?? 34.6937,
    lng: request.destLng ?? 135.5023,
  };

  const route = await ensureRequestRoute(
    request.id,
    origin,
    destination,
    request.routePolyline
  );

  if (!request.routePolyline && route.polyline) {
    await prisma.transportRequest.update({
      where: { id: request.id },
      data: {
        routePolyline: route.polyline,
        routeDistanceKm: route.distanceKm || request.routeDistanceKm,
        routeDurationMin: route.durationMin || request.routeDurationMin,
      },
    });
  }

  return NextResponse.json({
    coordinates: route.coordinates,
    distanceKm: route.distanceKm || request.routeDistanceKm,
    durationMin: route.durationMin || request.routeDurationMin,
  });
}
