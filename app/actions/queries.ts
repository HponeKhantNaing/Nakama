'use server';

import prisma from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { OrderStatus, CompanyType } from '@prisma/client';
import { AnalyticsData } from '@/types';
import { startOfMonth, subMonths, format } from 'date-fns';

const requestInclude = {
  creatorCompany: { select: { id: true, name: true } },
  handlerCompany: { select: { id: true, name: true } },
  tripAllocation: {
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
    },
  },
  subContractAssignment: {
    include: {
      subcontractor: { select: { id: true, name: true } },
    },
  },
};

export async function getMaruichiRequests() {
  const session = await requireRole(['MARUICHI_STAFF']);
  return prisma.transportRequest.findMany({
    where: { creatorCompanyId: session.user.companyId },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getShinwaIncomingOrders() {
  await requireRole(['SHINWA_STAFF']);
  return prisma.transportRequest.findMany({
    where: {
      OR: [
        { status: OrderStatus.PENDING },
        {
          handlerCompanyId: (
            await prisma.company.findFirst({ where: { type: CompanyType.SHINWA } })
          )?.id,
          status: {
            in: [
              OrderStatus.SHINWA_ACCEPTED,
              OrderStatus.DRIVER_ASSIGNED,
              OrderStatus.DISPATCHED,
              OrderStatus.PICKED_UP,
            ],
          },
        },
      ],
    },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getShinwaFleet() {
  const session = await requireRole(['SHINWA_STAFF']);
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { plateNumber: 'asc' },
    }),
    prisma.driver.findMany({
      where: { companyId: session.user.companyId },
      include: { user: { select: { email: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { vehicles, drivers };
}

export async function getSubcontractors() {
  await requireRole(['SHINWA_STAFF']);
  return prisma.company.findMany({
    where: { type: CompanyType.SUBCONTRACTOR },
    orderBy: { name: 'asc' },
  });
}

export async function getSubcontractorOrders() {
  const session = await requireRole(['SUBCONTRACTOR_STAFF']);
  return prisma.transportRequest.findMany({
    where: {
      subContractAssignment: { subcontractorId: session.user.companyId },
    },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSubcontractorFleet() {
  const session = await requireRole(['SUBCONTRACTOR_STAFF']);
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { plateNumber: 'asc' },
    }),
    prisma.driver.findMany({
      where: { companyId: session.user.companyId, isAvailable: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { vehicles, drivers };
}

export async function getDriverActiveJob() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({
    where: { userId: session.user.id },
  });
  if (!driver) return null;

  return prisma.transportRequest.findFirst({
    where: {
      tripAllocation: { driverId: driver.id },
      status: {
        in: [
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.DISPATCHED,
          OrderStatus.PICKED_UP,
        ],
      },
    },
    include: requestInclude,
  });
}

export async function getDriverHistory() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({
    where: { userId: session.user.id },
  });
  if (!driver) return [];

  return prisma.transportRequest.findMany({
    where: {
      tripAllocation: { driverId: driver.id },
      status: OrderStatus.DELIVERED,
    },
    include: requestInclude,
    orderBy: { deliveredAt: 'desc' },
    take: 20,
  });
}

export async function getNotifications() {
  const session = await requireAuth();
  return prisma.notification.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { companyId: session.user.companyId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getMaruichiAnalytics(): Promise<AnalyticsData> {
  const session = await requireRole(['MARUICHI_STAFF']);
  const companyId = session.user.companyId;

  const sixMonthsAgo = subMonths(startOfMonth(new Date()), 5);

  const requests = await prisma.transportRequest.findMany({
    where: {
      creatorCompanyId: companyId,
      createdAt: { gte: sixMonthsAgo },
    },
    include: {
      tripAllocation: {
        include: {
          driver: true,
          vehicle: true,
        },
      },
      subContractAssignment: true,
    },
  });

  const monthlyMap = new Map<string, number>();
  const costMap = new Map<string, number>();
  const vehicleUsage = new Map<string, number>();
  const driverDeliveries = new Map<string, number>();

  for (let i = 0; i < 6; i++) {
    const month = format(subMonths(new Date(), 5 - i), 'yyyy-MM');
    monthlyMap.set(month, 0);
    costMap.set(month, 0);
  }

  let delayedCount = 0;
  let subcontractedCount = 0;
  let totalCount = requests.length;

  for (const req of requests) {
    const month = format(req.createdAt, 'yyyy-MM');
    if (req.status === OrderStatus.DELIVERED) {
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
      costMap.set(month, (costMap.get(month) ?? 0) + (req.actualCost ?? req.estimatedCost ?? 0));
    }

    if (req.expectedPickupDate < new Date() && req.status !== OrderStatus.DELIVERED && req.status !== OrderStatus.CANCELLED) {
      delayedCount++;
    }

    if (req.subContractAssignment) {
      subcontractedCount++;
    }

    if (req.tripAllocation?.vehicle) {
      const plate = req.tripAllocation.vehicle.plateNumber;
      vehicleUsage.set(plate, (vehicleUsage.get(plate) ?? 0) + 1);
    }

    if (req.tripAllocation?.driver && req.status === OrderStatus.DELIVERED) {
      const name = req.tripAllocation.driver.name;
      driverDeliveries.set(name, (driverDeliveries.get(name) ?? 0) + 1);
    }
  }

  const totalVehicles = await prisma.vehicle.count();
  const usedVehicles = vehicleUsage.size;

  return {
    monthlyCompletedOrders: Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month: format(new Date(month + '-01'), 'MMM yyyy'),
      count,
    })),
    transportCostTrend: Array.from(costMap.entries()).map(([month, cost]) => ({
      month: format(new Date(month + '-01'), 'MMM yyyy'),
      cost,
    })),
    fleetUsage: Array.from(vehicleUsage.entries()).map(([vehicle, usage]) => ({
      vehicle,
      usage: totalVehicles > 0 ? Math.round((usage / totalVehicles) * 100) : 0,
    })),
    subcontractRatio: [
      { name: 'Direct', value: totalCount - subcontractedCount },
      { name: 'Subcontracted', value: subcontractedCount },
    ],
    delayedOrders: delayedCount,
    driverPerformance: Array.from(driverDeliveries.entries()).map(([driver, deliveries]) => ({
      driver,
      deliveries,
    })),
  };
}

export async function getMaruichiHistory() {
  const session = await requireRole(['MARUICHI_STAFF']);
  return prisma.transportRequest.findMany({
    where: {
      creatorCompanyId: session.user.companyId,
      status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
    },
    include: requestInclude,
    orderBy: { updatedAt: 'desc' },
  });
}
