import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRUCK_TYPE_MAP: Record<string, string> = {
  MEDIUM_TRUCK_4T: 'MEDIUM',
  LARGE_TRUCK_10T: 'TEN_TON',
  REFRIGERATED: 'MEDIUM',
  TRAILER: 'TEN_TON',
};

async function main() {
  await prisma.$executeRaw`
    UPDATE "Truck"
    SET "truckNo" = "truckNumber"
    WHERE "truckNo" IS NULL
  `;

  for (const [legacy, modern] of Object.entries(TRUCK_TYPE_MAP)) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Truck" SET "truckType" = $1::"TruckType" WHERE "truckType"::text = $2`,
      modern,
      legacy
    );
  }

  await prisma.$executeRaw`
    UPDATE "TransportRequest"
    SET "totalQuantity" = 0
    WHERE "totalQuantity" IS NULL
  `;

  const trucks = await prisma.truck.findMany({ select: { truckNo: true, truckNumber: true } });
  console.log('Backfill complete. Trucks:', trucks.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
