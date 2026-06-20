import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TranslatedText } from '@/components/i18n/translated-text';
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
        <TranslatedText messageKey="external.pageDesc" className="text-sm text-muted-foreground" />
        <ExternalCarrierPanel orders={orders as any} carriers={carriers} />
      </div>
    </DashboardShell>
  );
}
