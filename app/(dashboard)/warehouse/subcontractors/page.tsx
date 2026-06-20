import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TranslatedText } from '@/components/i18n/translated-text';
import { SubcontractOverview } from '@/components/yokomochi/SubcontractOverview';
import { getWarehouseSubcontractOverview } from '@/app/actions/yokomochi';
import { warehouseNavItems } from '@/lib/nav/yokomochi';

export default async function WarehouseSubcontractorsPage() {
  const assignments = await getWarehouseSubcontractOverview();

  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.subcontractors" />
        <TranslatedText messageKey="subcontract.warehousePageDesc" className="text-sm text-muted-foreground" />
        <SubcontractOverview assignments={assignments as any} />
      </div>
    </DashboardShell>
  );
}
