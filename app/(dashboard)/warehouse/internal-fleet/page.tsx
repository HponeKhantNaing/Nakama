import { getWarehouseYokomochiOrders, getDriverSchedule } from '@/app/actions/yokomochi';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { WarehouseInternalFleetClient } from './warehouse-internal-fleet-client';

type WarehouseOrder = Awaited<ReturnType<typeof getWarehouseYokomochiOrders>>[number];

export default async function WarehouseInternalFleetPage() {
  const session = await requireRole(['MARUICHI_STAFF']);
  const today = new Date().toISOString().slice(0, 10);

  const [orders, schedule, trucks] = await Promise.all([
    getWarehouseYokomochiOrders(),
    getDriverSchedule(today),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId, status: 'AVAILABLE' },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);

  const unassignedTrips = orders
    .filter((o: WarehouseOrder) => o.status === 'TRIPS_CALCULATED' || o.status === 'INTERNAL_SCHEDULING')
    .flatMap((o: WarehouseOrder) => o.trips.filter((t) => t.status === 'PLANNED'));

  return (
    <WarehouseInternalFleetClient
      date={today}
      drivers={schedule.drivers}
      trucks={trucks}
      schedules={schedule.schedules as any}
      unassignedTrips={unassignedTrips}
    />
  );
}
