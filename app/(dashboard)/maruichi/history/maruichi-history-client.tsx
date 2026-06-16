'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';

const navItems = [
  { href: '/maruichi', labelKey: 'nav.requests' as const },
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
    vehicle: { plateNumber: string };
  } | null;
};

export function MaruichiHistoryClient({ requests }: { requests: Request[] }) {
  return (
    <DashboardShell titleKey="dashboard.maruichi" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="maruichi.orderHistory" />
        <StatusTable requests={requests} />
      </div>
    </DashboardShell>
  );
}
