import { DriverStatus, TruckStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function releaseYokomochiFleetResources(
  tx: Tx,
  params: { truckId?: string | null; driverId: string }
) {
  if (params.truckId) {
    await tx.truck.update({
      where: { id: params.truckId },
      data: { status: TruckStatus.AVAILABLE },
    });
  }
  await tx.driver.update({
    where: { id: params.driverId },
    data: { isAvailable: true, status: DriverStatus.AVAILABLE },
  });
}
