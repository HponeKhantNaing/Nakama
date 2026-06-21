-- AlterTable
ALTER TABLE "DriverTask" ADD COLUMN "qrToken" TEXT;
ALTER TABLE "DriverTask" ADD COLUMN "qrExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "DriverTask_qrToken_key" ON "DriverTask"("qrToken");
CREATE INDEX "DriverTask_qrToken_idx" ON "DriverTask"("qrToken");
