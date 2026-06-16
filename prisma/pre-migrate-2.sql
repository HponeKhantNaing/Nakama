UPDATE "Truck" SET "truckType" = 'BANN' WHERE "truckType"::text = 'KEI_TRUCK';
UPDATE "Truck" SET "truckType" = 'SMALL' WHERE "truckType"::text = 'SMALL_TRUCK_2T';
UPDATE "Truck" SET "truckType" = 'MEDIUM' WHERE "truckType"::text = 'MEDIUM_TRUCK_4T';
UPDATE "Truck" SET "truckType" = 'TEN_TON' WHERE "truckType"::text IN ('LARGE_TRUCK_10T', 'TRAILER');
UPDATE "Truck" SET "truckType" = 'MEDIUM' WHERE "truckType"::text = 'REFRIGERATED';

ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "truckNo" TEXT;
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "maxBoxes" INTEGER NOT NULL DEFAULT 0;

UPDATE "Truck" SET "truckNo" = "truckNumber" WHERE "truckNo" IS NULL;

UPDATE "Truck" SET "maxBoxes" = 5 WHERE "truckType"::text = 'BANN' AND "maxBoxes" = 0;
UPDATE "Truck" SET "maxBoxes" = 24 WHERE "truckType"::text = 'SMALL' AND "maxBoxes" = 0;
UPDATE "Truck" SET "maxBoxes" = 40 WHERE "truckType"::text = 'MEDIUM' AND "maxBoxes" = 0;
UPDATE "Truck" SET "maxBoxes" = 96 WHERE "truckType"::text = 'TEN_TON' AND "maxBoxes" = 0;

ALTER TABLE "TransportRequest" ADD COLUMN IF NOT EXISTS "totalQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TransportRequest" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
