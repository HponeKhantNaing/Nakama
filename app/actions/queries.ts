'use server';

import prisma from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { OrderStatus, CompanyType, AssignmentStatus } from '@prisma/client';
import { AnalyticsData } from '@/types';
import { startOfMonth, subMonths, format } from 'date-fns';
import { computeRequestStatus, calculateRequestProgress, calculateRemaining, calculateAllocationRemaining } from '@/lib/tms/request-compute';

const requestInclude = {
  creatorCompany: { select: { id: true, name: true } },
  handlerCompany: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true } },
  proofOfDelivery: true,
  deliveryConfirmation: true,
  tripAllocation: {
    include: {
      driver: { select: { id: true, name: true, phone: true, currentLat: true, currentLng: true } },
      vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
      truck: { select: { id: true, plateNumber: true, truckNo: true, truckType: true } },
    },
  },
  truckAssignments: {
    where: { status: { not: AssignmentStatus.CANCELLED } },
    include: {
      truck: { select: { id: true, truckNo: true, truckType: true, plateNumber: true } },
      driver: { select: { id: true, name: true, phone: true, currentLat: true, currentLng: true } },
      deliveryProgress: { orderBy: { updatedAt: 'desc' as const }, take: 1 },
      assignmentConfirmation: {
        select: { approved: true, approvedAt: true, approvedBy: true, expiresAt: true },
      },
    },
  },
  deliveryItems: { include: { product: true } },
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
              OrderStatus.SPLIT,
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

type ShinwaBoardFilter =
  | 'all'
  | 'active'
  | 'completed'
  | 'pending'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'today';

function shinwaStatusWhere(filter: ShinwaBoardFilter) {
  if (filter === 'active')
    return {
      status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
    };
  if (filter === 'completed')
    return {
      status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
    };
  if (filter === 'pending') return { status: OrderStatus.PENDING };
  if (filter === 'delivered') return { status: OrderStatus.DELIVERED };
  if (filter === 'cancelled') return { status: OrderStatus.CANCELLED };
  if (filter === 'assigned')
    return {
      status: {
        in: [
          OrderStatus.SHINWA_ACCEPTED,
          OrderStatus.SPLIT,
          OrderStatus.DRIVER_ASSIGNED,
        ],
      },
    };
  if (filter === 'in_transit')
    return {
      status: {
        in: [
          OrderStatus.DISPATCHED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT,
          OrderStatus.ARRIVED,
          OrderStatus.AWAITING_CONFIRMATION,
        ],
      },
    };
  return {};
}

export async function getShinwaDeliveryBoard(input?: {
  filter?: ShinwaBoardFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireRole(['SHINWA_STAFF']);

  const filter = input?.filter ?? 'all';
  const pageSize = Math.min(100, Math.max(5, input?.pageSize ?? 50));
  const page = Math.max(1, input?.page ?? 1);
  const search = (input?.search ?? '').trim();

  const shinwaCompanyId = (
    await prisma.company.findFirst({ where: { type: CompanyType.SHINWA } })
  )?.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const where = {
    handlerCompanyId: shinwaCompanyId,
    ...(filter === 'today' ? { createdAt: { gte: todayStart } } : {}),
    ...shinwaStatusWhere(filter),
    ...(search
      ? {
          OR: [
            { requestNo: { contains: search, mode: 'insensitive' as const } },
            { origin: { contains: search, mode: 'insensitive' as const } },
            { destination: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, requests] = await Promise.all([
    prisma.transportRequest.count({ where }),
    prisma.transportRequest.findMany({
      where,
      include: requestInclude,
      orderBy:
        filter === 'completed' || filter === 'delivered'
          ? [{ deliveredAt: 'desc' }, { updatedAt: 'desc' }]
          : { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Compute derived status/progress/remaining based on ALL assignments (do not trust single-assignment UI)
  const computedRequests = await Promise.all(
    requests.map(async (r: any) => {
      const assignments = r.truckAssignments ?? [];
      const computedStatus = computeRequestStatus({
        requestStatus: r.status,
        assignments,
        totalQuantity: r.totalQuantity,
        totalWeight: r.cargoWeight,
      });
      const computedProgress = calculateRequestProgress({
        totalWeight: r.cargoWeight,
        assignments,
      });
      const remaining = calculateRemaining({
        totalWeight: r.cargoWeight,
        totalQuantity: r.totalQuantity,
        assignments,
      });
      const allocation = calculateAllocationRemaining({
        totalWeight: r.cargoWeight,
        totalQuantity: r.totalQuantity,
        assignments,
      });

      if (computedStatus !== r.status || computedProgress !== (r.progressPercent ?? 0)) {
        await prisma.transportRequest.update({
          where: { id: r.id },
          data: {
            status: computedStatus,
            progressPercent: computedProgress,
            deliveredAt: computedStatus === OrderStatus.DELIVERED ? r.deliveredAt ?? new Date() : null,
          },
        });
      }

      return {
        ...r,
        status: computedStatus,
        computedStatus,
        computedProgress,
        progressPercent: computedProgress,
        ...remaining,
        ...allocation,
      };
    })
  );

  const filteredRequests =
    filter === 'completed'
      ? computedRequests.filter(
          (r) => r.computedStatus === OrderStatus.DELIVERED || r.computedStatus === OrderStatus.CANCELLED
        )
      : filter === 'active'
        ? computedRequests.filter(
            (r) =>
              r.computedStatus !== OrderStatus.DELIVERED && r.computedStatus !== OrderStatus.CANCELLED
          )
        : computedRequests;

  // Stats across ALL Shinwa-handled requests (not just current page)
  const allWhereBase = { handlerCompanyId: shinwaCompanyId };
  const [pending, delivered, cancelled] = await Promise.all([
    prisma.transportRequest.count({
      where: { ...allWhereBase, status: OrderStatus.PENDING },
    }),
    prisma.transportRequest.count({
      where: { ...allWhereBase, status: OrderStatus.DELIVERED },
    }),
    prisma.transportRequest.count({
      where: { ...allWhereBase, status: OrderStatus.CANCELLED },
    }),
  ]);

  const assigned = await prisma.transportRequest.count({
    where: {
      ...allWhereBase,
      status: {
        in: [OrderStatus.SHINWA_ACCEPTED, OrderStatus.SPLIT, OrderStatus.DRIVER_ASSIGNED],
      },
    },
  });

  const inTransit = await prisma.transportRequest.count({
    where: {
      ...allWhereBase,
      status: {
        in: [
          OrderStatus.DISPATCHED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT,
          OrderStatus.ARRIVED,
          OrderStatus.AWAITING_CONFIRMATION,
        ],
      },
    },
  });

  return {
    requests: filteredRequests,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      total: await prisma.transportRequest.count({ where: allWhereBase }),
      pending,
      assigned,
      inTransit,
      delivered,
      cancelled,
    },
  };
}

export async function getShinwaFleet() {
  const session = await requireRole(['SHINWA_STAFF']);
  const [vehicles, drivers, trucks] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { plateNumber: 'asc' },
    }),
    prisma.driver.findMany({
      where: { companyId: session.user.companyId },
      include: { user: { select: { email: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);
  return { vehicles, drivers, trucks };
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
  const [drivers, trucks] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: 'asc' },
    }),
    prisma.truck.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { truckNumber: 'asc' },
    }),
  ]);
  return { drivers, trucks };
}

export async function getDriverActiveJob() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({
    where: { userId: session.user.id },
  });
  if (!driver) return null;

  // Important: requestInclude loads *all* truckAssignments.
  // For a split/multi-truck request, the first assignment may belong to a different driver,
  // which would cause "Assignment not found" when the driver tries to update status.
  // So for the driver view, only include assignments that belong to the logged-in driver.
  const driverRequestInclude = {
    ...requestInclude,
    truckAssignments: {
      where: { driverId: driver.id, status: { not: AssignmentStatus.CANCELLED } },
      include: requestInclude.truckAssignments.include,
    },
  } as const;

  return prisma.transportRequest.findFirst({
    where: {
      OR: [
        {
          tripAllocation: { driverId: driver.id },
          status: {
            in: [
              OrderStatus.DRIVER_ASSIGNED,
              OrderStatus.DISPATCHED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT,
              OrderStatus.ARRIVED,
              OrderStatus.AWAITING_CONFIRMATION,
            ],
          },
        },
        {
          truckAssignments: {
            some: {
              driverId: driver.id,
              status: {
                in: [
                  AssignmentStatus.ASSIGNED,
                  AssignmentStatus.DISPATCHED,
                  AssignmentStatus.PICKED_UP,
                  AssignmentStatus.IN_TRANSIT,
                  AssignmentStatus.ARRIVED,
                ],
              },
            },
          },
        },
      ],
    },
    include: driverRequestInclude,
  });
}

export async function getDriverHistory() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({
    where: { userId: session.user.id },
  });
  if (!driver) return [];

  const driverRequestInclude = {
    ...requestInclude,
    truckAssignments: {
      where: { driverId: driver.id, status: { not: AssignmentStatus.CANCELLED } },
      include: requestInclude.truckAssignments.include,
    },
  } as const;

  return prisma.transportRequest.findMany({
    where: {
      OR: [
        { tripAllocation: { driverId: driver.id }, status: OrderStatus.DELIVERED },
        {
          truckAssignments: {
            some: { driverId: driver.id, status: AssignmentStatus.DELIVERED },
          },
        },
      ],
    },
    include: driverRequestInclude,
    orderBy: { deliveredAt: 'desc' },
    take: 20,
  });
}

export async function getDriverDashboardData() {
  const session = await requireRole(['DRIVER']);
  const driver = await prisma.driver.findFirst({
    where: { userId: session.user.id },
    include: { company: { select: { name: true } } },
  });
  if (!driver) return { driver: null, activeJob: null, history: [], stats: null, notifications: [] };

  const [activeJob, history, notifications] = await Promise.all([
    getDriverActiveJob(),
    getDriverHistory(),
    getNotifications(),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const deliveredToday = await prisma.truckAssignment.count({
    where: { driverId: driver.id, status: AssignmentStatus.DELIVERED, deliveredAt: { gte: todayStart } },
  });
  const activeCount = activeJob ? 1 : 0;

  const boxesDeliveredTodayAgg = await prisma.truckAssignment.aggregate({
    where: { driverId: driver.id, status: AssignmentStatus.DELIVERED, deliveredAt: { gte: todayStart } },
    _sum: { assignedQuantity: true, assignedWeight: true },
  });

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      licenseType: driver.licenseType,
      status: driver.status,
      rating: driver.rating,
      companyName: driver.company.name,
    },
    activeJob,
    history,
    notifications,
    stats: {
      completedDeliveries: deliveredToday,
      activeDeliveries: activeCount,
      pendingDeliveries: 0,
      totalBoxesDelivered: boxesDeliveredTodayAgg._sum.assignedQuantity ?? 0,
      totalWeightDelivered: Math.round(boxesDeliveredTodayAgg._sum.assignedWeight ?? 0),
    },
  };
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

export async function getActiveFleetMonitor(filter: 'today' | 'in_transit' | 'delivered' = 'in_transit') {
  const session = await requireRole(['MARUICHI_STAFF']);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const inTransitStatuses = [
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.IN_TRANSIT,
    OrderStatus.ARRIVED,
    OrderStatus.AWAITING_CONFIRMATION,
  ];

  const baseWhere = {
    creatorCompanyId: session.user.companyId,
    OR: [
      { tripAllocation: { isNot: null } },
      { truckAssignments: { some: {} } },
    ],
    ...(filter === 'today' ? { createdAt: { gte: todayStart } } : {}),
  };

  if (filter === 'delivered') {
    return prisma.transportRequest.findMany({
      where: { ...baseWhere, status: OrderStatus.DELIVERED },
      include: requestInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  if (filter === 'in_transit') {
    return prisma.transportRequest.findMany({
      where: { ...baseWhere, status: { in: inTransitStatuses } },
      include: requestInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  return prisma.transportRequest.findMany({
    where: {
      ...baseWhere,
      status: { notIn: [OrderStatus.PENDING, OrderStatus.CANCELLED] },
    },
    include: requestInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}
