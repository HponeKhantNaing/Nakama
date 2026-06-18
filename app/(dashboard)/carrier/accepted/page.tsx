import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { CarrierAcceptedClient } from '@/components/yokomochi/CarrierAcceptedClient';
import { getCarrierAcceptedTrips, getCarrierFleetResources } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierAcceptedPage() {
  const [trips, fleet] = await Promise.all([getCarrierAcceptedTrips(), getCarrierFleetResources()]);

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.acceptedJobs" />
        <CarrierAcceptedClient trips={trips as any} drivers={fleet.drivers} trucks={fleet.trucks} />
      </div>
    </DashboardShell>
  );
}
