import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { CarrierFleetManager } from '@/components/yokomochi/CarrierFleetManager';
import { getCarrierFleetDirectory } from '@/app/actions/carrier-fleet';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierFleetPage() {
  const { drivers, trucks } = await getCarrierFleetDirectory();

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.driversAndVehicles" />
        <p className="text-sm text-muted-foreground">
          Register drivers and vehicles for fleet allocation. Capacity rules apply on Accepted Jobs.
        </p>
        <CarrierFleetManager drivers={drivers as any} trucks={trucks as any} />
      </div>
    </DashboardShell>
  );
}
