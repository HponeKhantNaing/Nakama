'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { assignCarrierTripDriver } from '@/app/actions/yokomochi';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

type Trip = {
  id: string;
  tripNo: number;
  tripCode: string;
  pallets: number;
  boxes: number;
  status: string;
  yokomochiOrder: { orderNo: string; cargoType: string | null };
  driverTask?: {
    driver: { name: string };
    truck: { truckNo: string | null; plateNumber: string } | null;
  } | null;
};

export function CarrierAcceptedClient({
  trips,
  drivers,
  trucks,
}: {
  trips: Trip[];
  drivers: { id: string; name: string }[];
  trucks: { id: string; truckNo: string | null; truckNumber: string }[];
}) {
  const router = useRouter();
  const { t, statusLabel } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [selections, setSelections] = useState<Record<string, { driverId: string; truckId: string }>>({});

  const pending = trips.filter((trip) => trip.status === 'CARRIER_ASSIGNED');

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('carrier.noAcceptedTrips')}
      </div>
    );
  }

  function assign(tripId: string) {
    const sel = selections[tripId];
    if (!sel?.driverId || !sel?.truckId) return;
    startTransition(async () => {
      await assignCarrierTripDriver({ tripId, driverId: sel.driverId, truckId: sel.truckId });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {interpolate(t('carrier.tripsNeedAssignment'), { count: pending.length })}
        </p>
      )}
      {trips.map((trip) => (
        <div key={trip.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{trip.yokomochiOrder.orderNo}</p>
              <p className="font-medium">{trip.tripCode}</p>
              <p className="text-sm text-muted-foreground">
                {interpolate(t('yokomochi.palletsBoxesShort'), {
                  pallets: trip.pallets,
                  boxes: trip.boxes,
                })}{' '}
                · {trip.yokomochiOrder.cargoType ?? '—'}
              </p>
            </div>
            <Badge variant="outline">{statusLabel(trip.status)}</Badge>
          </div>

          {trip.driverTask ? (
            <p className="mt-3 text-sm">
              {t('carrier.driverColon')}: <strong>{trip.driverTask.driver.name}</strong> ·{' '}
              {t('carrier.truckColon')}:{' '}
              {trip.driverTask.truck?.truckNo ?? trip.driverTask.truck?.plateNumber ?? '—'}
            </p>
          ) : trip.status === 'CARRIER_ASSIGNED' ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={selections[trip.id]?.driverId ?? ''}
                onChange={(e) =>
                  setSelections((s) => ({
                    ...s,
                    [trip.id]: { ...s[trip.id], driverId: e.target.value, truckId: s[trip.id]?.truckId ?? '' },
                  }))
                }
              >
                <option value="">{t('shinwa.selectDriver')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={selections[trip.id]?.truckId ?? ''}
                onChange={(e) =>
                  setSelections((s) => ({
                    ...s,
                    [trip.id]: { driverId: s[trip.id]?.driverId ?? '', truckId: e.target.value },
                  }))
                }
              >
                <option value="">{t('shinwa.selectVehicle')}</option>
                {trucks.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.truckNo ?? tr.truckNumber}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={isPending} onClick={() => assign(trip.id)}>
                {t('subcontractor.assign')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
