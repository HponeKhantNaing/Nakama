import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const dateFilter =
    from && to
      ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
      : {};

  const [
    deliveries,
    gpsRecords,
    trips,
    trucks,
    drivers,
  ] = await Promise.all([
    prisma.transportRequest.findMany({
      where: { status: OrderStatus.DELIVERED, ...dateFilter },
      include: { tripAllocation: { include: { truck: true, driver: true } } },
    }),
    prisma.gpsHistory.findMany({
      where: dateFilter.createdAt ? { recordedAt: dateFilter.createdAt } : {},
      select: { transportRequestId: true, speed: true },
    }),
    prisma.tripAllocation.findMany({
      where: { distanceTraveledKm: { not: null } },
      include: { truck: true, driver: true },
    }),
    prisma.truck.count(),
    prisma.driver.findMany({ select: { id: true, name: true, totalDeliveries: true, rating: true } }),
  ]);

  const totalDistance = trips.reduce((s, t) => s + (t.distanceTraveledKm ?? 0), 0);
  const totalFuel = trips.reduce((s, t) => s + (t.fuelUsedLiters ?? 0), 0);
  const onTime = deliveries.filter((d) => d.onTime === true).length;
  const late = deliveries.filter((d) => d.onTime === false).length;
  const subcontracted = await prisma.deliverySplit.count();

  const truckUsage = await prisma.tripAllocation.groupBy({
    by: ['truckId'],
    _count: { truckId: true },
    where: { truckId: { not: null } },
  });

  const utilization =
    trucks > 0
      ? Math.round((truckUsage.length / trucks) * 100)
      : 0;

  const driverPerformance = drivers.map((d) => ({
    driver: d.name,
    deliveries: d.totalDeliveries,
    rating: d.rating,
  }));

  const etaAccuracy = deliveries.filter((d) => d.eta && d.deliveredAt).length > 0
    ? Math.round(
        (deliveries.filter(
          (d) => d.eta && d.deliveredAt && Math.abs(d.deliveredAt.getTime() - d.eta.getTime()) < 30 * 60 * 1000
        ).length /
          deliveries.filter((d) => d.eta && d.deliveredAt).length) *
          100
      )
    : 0;

  return NextResponse.json({
    monthlyDeliveries: deliveries.length,
    truckUtilizationPercent: utilization,
    totalDistanceKm: Math.round(totalDistance),
    fuelConsumptionLiters: Math.round(totalFuel),
    onTimeRate: deliveries.length > 0 ? Math.round((onTime / deliveries.length) * 100) : 0,
    lateDeliveries: late,
    subcontractRatio: deliveries.length > 0 ? Math.round((subcontracted / deliveries.length) * 100) : 0,
    driverPerformance,
    etaAccuracyPercent: etaAccuracy,
    gpsPointsRecorded: gpsRecords.length,
  });
}
