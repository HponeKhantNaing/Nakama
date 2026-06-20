import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TranslatedText } from '@/components/i18n/translated-text';
import { SubcontractOverview } from '@/components/yokomochi/SubcontractOverview';
import { getCarrierSubcontractTrips } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';

export default async function CarrierSubcontractPage() {
  const assignments = await getCarrierSubcontractTrips();

  const mapped = assignments.map((a) => ({
    id: a.id,
    assignedTrips: a.assignedTrips,
    createdAt: a.createdAt,
    subcontractor: a.subcontractor,
    trip: {
      tripCode: a.trip.tripCode,
      pallets: a.trip.pallets,
      status: a.trip.status,
      yokomochiOrder: a.trip.yokomochiOrder,
    },
  }));

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.subcontract" />
        <TranslatedText messageKey="subcontract.carrierPageDesc" className="text-sm text-muted-foreground" />
        <SubcontractOverview assignments={mapped as any} />
      </div>
    </DashboardShell>
  );
}
