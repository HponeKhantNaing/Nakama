import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { CarrierAcceptedAllocationClient } from '@/components/yokomochi/CarrierAcceptedAllocationClient';
import { getCarrierAcceptedJobGroups, getCarrierFleetDirectory } from '@/app/actions/carrier-fleet';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export const dynamic = 'force-dynamic';

export default async function CarrierAcceptedPage() {
  const [jobGroups, fleet] = await Promise.all([
    getCarrierAcceptedJobGroups(),
    getCarrierFleetDirectory(),
  ]);

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.acceptedJobs" />
        <p className="text-sm text-muted-foreground">
          Allocate registered vehicles to accepted jobs. Remaining boxes update as you add trucks and
          delivery times.
        </p>
        <CarrierAcceptedAllocationClient
          jobGroups={jobGroups}
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
