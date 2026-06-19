import { getWarehouseYokomochiOrders, getDriverSchedule } from '@/app/actions/yokomochi';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { earliestScheduleDate } from '@/lib/yokomochi/dates';
import { WarehouseInternalFleetClient } from './warehouse-internal-fleet-client';

type WarehouseOrder = Awaited<ReturnType<typeof getWarehouseYokomochiOrders>>[number];

export default async function WarehouseInternalFleetPage() {
  const session = await requireRole(['MARUICHI_STAFF']);

  const orders = await getWarehouseYokomochiOrders();

  const scheduleDates = orders.flatMap((o: WarehouseOrder) =>
    (o.deliverySchedules ?? []).map((s) => s.deliveryDate)
  );
  const tripDates = orders.flatMap((o: WarehouseOrder) =>
    o.trips.filter((t) => t.status === 'PLANNED' || t.status === 'INTERNAL_ASSIGNED').map((t) => t.scheduledDate)
  );
  const initialDate = earliestScheduleDate([...scheduleDates, ...tripDates]);

  const [schedule, trucks] = await Promise.all([
    getDriverSchedule(initialDate),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);

  const unassignedTrips = orders
    .filter((o: WarehouseOrder) => o.status === 'TRIPS_CALCULATED' || o.status === 'INTERNAL_SCHEDULING')
    .flatMap((o: WarehouseOrder) =>
      o.trips.filter((t) => t.status === 'PLANNED').map((t) => ({ ...t, scheduledDate: t.scheduledDate }))
    );

  return (
    <WarehouseInternalFleetClient
      initialDate={initialDate}
      drivers={schedule.drivers}
      trucks={trucks}
      schedules={schedule.schedules as any}
      unassignedTrips={unassignedTrips}
    />
  );
}
