'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { factoryNavItems } from '@/lib/nav/yokomochi';
import { YokomochiOrderAccordion } from '@/components/yokomochi/YokomochiOrderAccordion';
import { useTranslation } from '@/lib/i18n/context';

export function FactoryHistoryClient({
  orders,
}: {
  orders: any[];
}) {
  const { t } = useTranslation();

  return (
    <DashboardShell titleKey="dashboard.factory" navItems={factoryNavItems}>
      <PageHeader titleKey="nav.orderHistory" />
      <YokomochiOrderAccordion orders={orders} mode="history" negotiationViewerRole="FACTORY_STAFF" />
    </DashboardShell>
  );
}
