'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';

const navItems = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' as const },
  { href: '/driver/history', labelKey: 'nav.history' as const },
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

export function DriverHistoryClient({ history }: { history: Request[] }) {
  return (
    <DashboardShell titleKey="dashboard.driver" navItems={navItems}>
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader titleKey="driver.completedHistory" />
        <StatusTable requests={history} />
      </div>
    </DashboardShell>
  );
}
