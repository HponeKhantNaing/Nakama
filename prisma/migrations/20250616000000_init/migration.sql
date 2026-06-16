-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('MARUICHI', 'SHINWA', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MARUICHI_STAFF', 'SHINWA_STAFF', 'SUBCONTRACTOR_STAFF', 'DRIVER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SHINWA_ACCEPTED', 'SUBCONTRACTED', 'DRIVER_ASSIGNED', 'DISPATCHED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SMALL_TRUCK', 'MEDIUM_TRUCK', 'LARGE_TRUCK', 'TRAILER', 'REFRIGERATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_REQUEST', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'DRIVER_ASSIGNED', 'STATUS_UPDATE', 'SUBCONTRACT_ASSIGNED', 'DELIVERY_COMPLETE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "companyId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNo" TEXT,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRequest" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cargoType" TEXT NOT NULL,
    "cargoWeight" DOUBLE PRECISION NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "vehicleCount" INTEGER NOT NULL DEFAULT 1,
    "expectedPickupDate" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "notes" TEXT,
    "proofImageUrl" TEXT,
    "deliveryPhotoUrl" TEXT,
    "creatorCompanyId" TEXT NOT NULL,
    "handlerCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "TransportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubContractAssignment" (
    "id" TEXT NOT NULL,
    "transportRequestId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "SubContractAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAllocation" (
    "id" TEXT NOT NULL,
    "transportRequestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "transportRequestId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE INDEX "Vehicle_companyId_idx" ON "Vehicle"("companyId");

-- CreateIndex
CREATE INDEX "Vehicle_isAvailable_idx" ON "Vehicle"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");

-- CreateIndex
CREATE INDEX "Driver_isAvailable_idx" ON "Driver"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRequest_requestNo_key" ON "TransportRequest"("requestNo");

-- CreateIndex
CREATE INDEX "TransportRequest_status_idx" ON "TransportRequest"("status");

-- CreateIndex
CREATE INDEX "TransportRequest_creatorCompanyId_idx" ON "TransportRequest"("creatorCompanyId");

-- CreateIndex
CREATE INDEX "TransportRequest_handlerCompanyId_idx" ON "TransportRequest"("handlerCompanyId");

-- CreateIndex
CREATE INDEX "TransportRequest_createdAt_idx" ON "TransportRequest"("createdAt");

-- CreateIndex
CREATE INDEX "TransportRequest_expectedPickupDate_idx" ON "TransportRequest"("expectedPickupDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubContractAssignment_transportRequestId_key" ON "SubContractAssignment"("transportRequestId");

-- CreateIndex
CREATE INDEX "SubContractAssignment_subcontractorId_idx" ON "SubContractAssignment"("subcontractorId");

-- CreateIndex
CREATE UNIQUE INDEX "TripAllocation_transportRequestId_key" ON "TripAllocation"("transportRequestId");

-- CreateIndex
CREATE INDEX "TripAllocation_driverId_idx" ON "TripAllocation"("driverId");

-- CreateIndex
CREATE INDEX "TripAllocation_vehicleId_idx" ON "TripAllocation"("vehicleId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Company_type_idx" ON "Company"("type");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRequest" ADD CONSTRAINT "TransportRequest_creatorCompanyId_fkey" FOREIGN KEY ("creatorCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRequest" ADD CONSTRAINT "TransportRequest_handlerCompanyId_fkey" FOREIGN KEY ("handlerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubContractAssignment" ADD CONSTRAINT "SubContractAssignment_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "TransportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubContractAssignment" ADD CONSTRAINT "SubContractAssignment_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAllocation" ADD CONSTRAINT "TripAllocation_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "TransportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAllocation" ADD CONSTRAINT "TripAllocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAllocation" ADD CONSTRAINT "TripAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "TransportRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
