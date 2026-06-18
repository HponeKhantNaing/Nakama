'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { DriverCompletedJobsTable } from '@/components/yokomochi/DriverCompletedJobsTable';
import type { DriverCompletedJobRow } from '@/components/yokomochi/DriverCompletedJobsTable';

const navItems = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' as const },
  { href: '/driver/history', labelKey: 'nav.history' as const },
];

export function DriverHistoryClient({ history }: { history: DriverCompletedJobRow[] }) {
  return (
    <DashboardShell titleKey="dashboard.driver" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="driver.completedHistory" />
        <DriverCompletedJobsTable rows={history} />
      </div>
    </DashboardShell>
  );
}
