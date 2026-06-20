import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TranslatedText } from '@/components/i18n/translated-text';
import { CarrierCompletedClient } from './carrier-completed-client';
import { getCarrierCompletedTrips } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierCompletedPage() {
  const trips = await getCarrierCompletedTrips();

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.deliveredRequests" />
        <CarrierCompletedClient trips={trips as any} />
      </div>
    </DashboardShell>
  );
}
