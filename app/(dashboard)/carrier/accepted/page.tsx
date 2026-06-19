import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { getCarrierAcceptedJobGroups, getCarrierFleetDirectory } from '@/app/actions/carrier-fleet';
import { getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';
import { CarrierAcceptedPageClient } from './carrier-accepted-page-client';

export const dynamic = 'force-dynamic';

export default async function CarrierAcceptedPage() {
  const [jobGroups, fleet, deliveries] = await Promise.all([
    getCarrierAcceptedJobGroups(),
    getCarrierFleetDirectory(),
    getYokomochiDeliveryTracking(),
  ]);

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.acceptedJobs" />
        <CarrierAcceptedPageClient
          jobGroups={jobGroups}
          deliveries={deliveries}
          drivers={fleet.drivers.map((d) => ({
            id: d.id,
            name: d.name,
            isAvailable: d.isAvailable,
          }))}
          trucks={fleet.trucks.map((t) => ({
            id: t.id,
            truckNo: t.truckNo,
            truckNumber: t.truckNumber,
            truckType: t.truckType,
            status: t.status,
          }))}
        />
      </div>
    </DashboardShell>
  );
}
