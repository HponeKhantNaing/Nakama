import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { getCarrierCompletedTrips } from '@/app/actions/yokomochi';
import { carrierNavItems } from '@/lib/nav/yokomochi';
import { formatDate } from '@/lib/utils';

export default async function CarrierCompletedPage() {
  const trips = await getCarrierCompletedTrips();

  return (
    <DashboardShell titleKey="dashboard.carrier" navItems={carrierNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.deliveredRequests" />
        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No completed carrier trips yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-mono text-xs">{trip.yokomochiOrder.orderNo}</p>
                  <p className="font-medium">{trip.tripCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {trip.driverTask?.driver.name ?? '—'} · {formatDate(trip.updatedAt)}
                  </p>
                </div>
                <Badge variant="secondary">{trip.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
