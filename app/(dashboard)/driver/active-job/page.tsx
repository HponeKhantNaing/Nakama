import { getDriverActiveYokomochiTask } from '@/app/actions/yokomochi';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { DriverYokomochiDashboard } from '@/components/yokomochi/DriverYokomochiDashboard';

export default async function DriverActiveJobPage() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });

  const [task, history] = await Promise.all([
    getDriverActiveYokomochiTask(),
    driver
      ? prisma.driverTask.findMany({
          where: { driverId: driver.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
          include: {
            trip: { include: { yokomochiOrder: true } },
            truck: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })
      : [],
  ]);

  return <DriverYokomochiDashboard task={task as any} history={history as any} />;
}
