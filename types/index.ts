import { UserRole } from '@/lib/roles';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      companyId: string;
      companyName: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: UserRole;
    companyId: string;
    companyName: string;
    rememberMe?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email?: string;
    role: UserRole;
    companyId: string;
    companyName: string;
  }
}

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type TransportRequestWithRelations = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  cargoType: string;
  cargoWeight: number;
  vehicleType: string;
  vehicleCount: number;
  expectedPickupDate: Date;
  status: string;
  estimatedCost: number | null;
  actualCost: number | null;
  notes: string | null;
  proofImageUrl: string | null;
  deliveryPhotoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
  creatorCompany?: { id: string; name: string };
  handlerCompany?: { id: string; name: string } | null;
  tripAllocation?: {
    id: string;
    dispatchedAt: Date | null;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    driver: { id: string; name: string; phone: string | null };
    vehicle: { id: string; plateNumber: string; vehicleType: string };
  } | null;
  subContractAssignment?: {
    id: string;
    subcontractor: { id: string; name: string };
  } | null;
};

export type AnalyticsData = {
  monthlyCompletedOrders: { month: string; count: number }[];
  transportCostTrend: { month: string; cost: number }[];
  fleetUsage: { vehicle: string; usage: number }[];
  subcontractRatio: { name: string; value: number }[];
  delayedOrders: number;
  driverPerformance: { driver: string; deliveries: number }[];
};
