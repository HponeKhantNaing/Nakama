import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { CarrierRequestAccordion } from '@/components/yokomochi/CarrierRequestAccordion';
import { getCarrierYokomochiRequests } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierRequestsPage() {
  const requests = await getCarrierYokomochiRequests();

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.newRequests" />
        <p className="text-sm text-muted-foreground">
          20号物流センターからの横持残便依頼。対応可能便数を回答してください。
        </p>
        <CarrierRequestAccordion requests={requests as any} />
      </div>
    </DashboardShell>
  );
}
