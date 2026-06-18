'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import {
  YokomochiOrderAccordion,
  CreateFactoryRequestForm,
} from '@/components/yokomochi/YokomochiOrderAccordion';

export function WarehouseFactoryRequestsClient({
  orders,
  factories,
}: {
  orders: any[];
  factories: { id: string; name: string }[];
}) {
  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.factoryRequests" />
        <CreateFactoryRequestForm factories={factories} />
        <YokomochiOrderAccordion orders={orders} mode="warehouse" />
      </div>
    </DashboardShell>
  );
}
