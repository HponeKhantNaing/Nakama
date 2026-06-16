'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TransportRequestForm } from '@/components/forms/transport-request-form';
import { StatusTable } from '@/components/tables/status-table';

const navItems = [
  { href: '/maruichi', labelKey: 'nav.requests' as const },
  { href: '/maruichi/monitor', labelKey: 'nav.monitor' as const },
  { href: '/maruichi/analytics', labelKey: 'nav.analytics' as const },
  { href: '/maruichi/history', labelKey: 'nav.history' as const },
];

type Request = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  updatedAt: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle?: { plateNumber: string } | null;
    truck?: { plateNumber: string; truckNo?: string | null } | null;
  } | null;
  truckAssignments?: {
    driver?: { name: string } | null;
    truck?: { truckNo: string | null; plateNumber: string } | null;
  }[];
};

export function MaruichiPageClient({ requests }: { requests: Request[] }) {
  return (
    <DashboardShell titleKey="dashboard.maruichi" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="maruichi.hero" />
        <TransportRequestForm />
        <div>
          <PageHeader titleKey="maruichi.realTimeStatus" />
          <StatusTable requests={requests} />
        </div>
      </div>
    </DashboardShell>
  );
}
