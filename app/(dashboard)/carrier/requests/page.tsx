import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TranslatedText } from '@/components/i18n/translated-text';
import { CarrierRequestAccordion } from '@/components/yokomochi/CarrierRequestAccordion';
import { getCarrierYokomochiRequests } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierRequestsPage() {
  const requests = await getCarrierYokomochiRequests();

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.newRequests" />
        <TranslatedText messageKey="carrier.requestsPageDesc" className="text-sm text-muted-foreground" />
        <CarrierRequestAccordion requests={requests as any} />
      </div>
    </DashboardShell>
  );
}
