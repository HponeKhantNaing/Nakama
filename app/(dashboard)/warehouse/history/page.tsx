import { getWarehouseYokomochiOrders } from '@/app/actions/yokomochi';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import { YokomochiOrderAccordion } from '@/components/yokomochi/YokomochiOrderAccordion';

export default async function WarehouseHistoryPage() {
  const orders = await getWarehouseYokomochiOrders();
  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.deliveryHistory" />
        <YokomochiOrderAccordion orders={orders} mode="history" />
      </div>
    </DashboardShell>
  );
}
