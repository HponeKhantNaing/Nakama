'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitCarrierResponse } from '@/app/actions/yokomochi';
import { formatFleetTripPlan } from '@/lib/yokomochi/carrier-fleet-plan';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

function parsePositiveInt(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function CarrierResponseForm({
  requestId,
  suggestedTrips,
}: {
  requestId: string;
  suggestedTrips: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [availableTrips, setAvailableTrips] = useState(String(Math.max(1, suggestedTrips)));
  const [fleetCount, setFleetCount] = useState(
    String(Math.min(Math.max(1, suggestedTrips), 2))
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const trips = Math.max(1, suggestedTrips);
    setAvailableTrips(String(trips));
    setFleetCount((prev) => {
      const n = parsePositiveInt(prev, 1);
      return String(Math.min(Math.max(1, n), trips));
    });
  }, [suggestedTrips]);

  const tripsNum = Math.max(1, parsePositiveInt(availableTrips, suggestedTrips || 1));
  const fleetNum = Math.max(1, parsePositiveInt(fleetCount, 1));
  const maxTrips = Math.max(1, suggestedTrips);

  const tripPlan =
    tripsNum > 0 && fleetNum > 0 ? formatFleetTripPlan(tripsNum, fleetNum) : '';

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        const trips = Math.max(1, parsePositiveInt(availableTrips, 1));
        const fleet = Math.max(1, parsePositiveInt(fleetCount, 1));
        if (trips > maxTrips) {
          setError(interpolate(t('carrier.tripsExceedMax'), { max: maxTrips }));
          return;
        }
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await submitCarrierResponse({
            carrierRequestId: requestId,
            availableTrips: trips,
            truckCount: fleet,
            driverCount: fleet,
            truckInfo: String(fd.get('truckInfo') || ''),
            driverInfo: String(fd.get('driverInfo') || ''),
            estimatedPickupTime: String(fd.get('estimatedPickupTime') || ''),
            notes: String(fd.get('notes') || ''),
          });
          if (result.success) {
            router.push('/carrier/accepted');
            return;
          }
          setError(result.error ?? t('carrier.submitResponseFailed'));
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`trips-${requestId}`}>{t('carrier.availableTrips')}</Label>
        <Input
          id={`trips-${requestId}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={availableTrips}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setAvailableTrips(v);
            const n = parsePositiveInt(v, 0);
            if (n > 0) {
              setFleetCount((prev) => {
                const f = parsePositiveInt(prev, 1);
                return String(Math.min(f, n));
              });
            }
          }}
          onBlur={() => {
            const n = Math.max(1, Math.min(maxTrips, parsePositiveInt(availableTrips, 1)));
            setAvailableTrips(String(n));
          }}
          required
        />
        <p className="text-xs text-muted-foreground">
          {interpolate(t('carrier.tripsMaxHint'), { max: maxTrips })}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`fleet-${requestId}`}>{t('carrier.trucksDriversSameCount')}</Label>
        <Input
          id={`fleet-${requestId}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={fleetCount}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setFleetCount(v);
          }}
          onBlur={() => {
            const n = Math.max(1, parsePositiveInt(fleetCount, 1));
            setFleetCount(String(n));
          }}
          required
        />
        <p className="text-xs text-muted-foreground">{t('carrier.fleetEqualHint')}</p>
      </div>
      {tripPlan && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs sm:col-span-2">
          {t('carrier.tripPlan')}: <strong>{tripPlan}</strong>
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor={`pickup-${requestId}`}>{t('carrier.estimatedPickup')}</Label>
        <Input id={`pickup-${requestId}`} name="estimatedPickupTime" type="datetime-local" required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`truckinfo-${requestId}`}>{t('carrier.truckInfo')}</Label>
        <Input
          id={`truckinfo-${requestId}`}
          name="truckInfo"
          placeholder={t('carrier.truckInfoPlaceholder')}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`driverinfo-${requestId}`}>{t('carrier.driverInfo')}</Label>
        <Input id={`driverinfo-${requestId}`} name="driverInfo" placeholder={t('carrier.driverInfoPlaceholder')} />
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {t('carrier.submitResponse')}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{t('carrier.autoSplitHint')}</p>
      </div>
    </form>
  );
}
