'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { AnalyticsCharts, AnalyticsSummary } from '@/components/charts/analytics-charts';
import { AnalyticsData } from '@/types';

const navItems = [
  { href: '/maruichi', labelKey: 'nav.requests' as const },
  { href: '/maruichi/analytics', labelKey: 'nav.analytics' as const },
  { href: '/maruichi/history', labelKey: 'nav.history' as const },
];

export function MaruichiAnalyticsClient({ analytics }: { analytics: AnalyticsData }) {
  return (
    <DashboardShell titleKey="dashboard.maruichi" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="maruichi.analytics" />
        <AnalyticsSummary data={analytics} />
        <AnalyticsCharts data={analytics} />
      </div>
    </DashboardShell>
  );
}
