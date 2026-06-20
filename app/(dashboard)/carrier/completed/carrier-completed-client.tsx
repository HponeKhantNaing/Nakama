'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';

type CompletedTrip = {
  id: string;
  tripCode: string;
  status: string;
  updatedAt: Date;
  yokomochiOrder: { orderNo: string };
  driverTask?: { driver: { name: string } } | null;
};

export function CarrierCompletedClient({ trips }: { trips: CompletedTrip[] }) {
  const { t, formatDate, statusLabel } = useTranslation();

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('carrier.noCompletedTrips')}
      </div>
    );
  }

  return (
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
          <Badge variant="secondary">{statusLabel(trip.status)}</Badge>
        </div>
      ))}
    </div>
  );
}
