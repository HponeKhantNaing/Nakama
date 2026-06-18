import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { ExternalCarrierPanel } from '@/components/yokomochi/ExternalCarrierPanel';
import { getCarrierCompanies, getWarehouseExternalCarrierOrders } from '@/app/actions/yokomochi';
import { warehouseNavItems } from '@/lib/nav/yokomochi';

export default async function WarehouseExternalCarrierPage() {
  const [orders, carriers] = await Promise.all([
    getWarehouseExternalCarrierOrders(),
    getCarrierCompanies(),
  ]);

  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.externalCarrier" />
        <p className="text-sm text-muted-foreground">
          After internal fleet scheduling, send remaining trips to 建会社（進和運輸）.
        </p>
        <ExternalCarrierPanel orders={orders as any} carriers={carriers} />
      </div>
    </DashboardShell>
  );
}
