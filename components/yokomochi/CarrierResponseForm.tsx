'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { submitCarrierResponse } from '@/app/actions/yokomochi';
import { buildPickupDateTime, PICKUP_HOURS } from '@/lib/yokomochi/date-picker-rules';
import { formatLocaleDate } from '@/lib/i18n/format';
import { useTranslation } from '@/lib/i18n/context';
import { toLocalDateString } from '@/lib/yokomochi/dates';

export function CarrierResponseForm({
  requestId,
  suggestedTrips,
  deliveryDate,
}: {
  requestId: string;
  suggestedTrips: number;
  deliveryDate: string;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [pickupHour, setPickupHour] = useState<number>(8);
  const [error, setError] = useState('');

  const formattedDeliveryDate = deliveryDate
    ? formatLocaleDate(deliveryDate, locale)
    : '—';

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!deliveryDate) {
          setError(t('carrier.deliveryDateRequired'));
          return;
        }

        const estimatedPickupTime = buildPickupDateTime(deliveryDate, pickupHour);

        startTransition(async () => {
          const result = await submitCarrierResponse({
            carrierRequestId: requestId,
            availableTrips: Math.max(1, suggestedTrips),
            truckCount: 1,
            driverCount: 1,
            estimatedPickupTime,
            notes: '',
          });
          if (result.success) {
            router.push('/carrier/accepted');
            return;
          }
          setError(result.error ?? t('carrier.submitResponseFailed'));
        });
      }}
    >
      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">{t('carrier.deliveryDate')}</p>
        <p className="text-lg font-semibold">{formattedDeliveryDate}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('carrier.fixedDeliveryDateHint')}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`pickup-hour-${requestId}`}>{t('carrier.estimatedPickupHour')}</Label>
        <select
          id={`pickup-hour-${requestId}`}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={pickupHour}
          onChange={(e) => setPickupHour(Number(e.target.value))}
          required
        >
          {PICKUP_HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t('carrier.pickupHourHint')}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('carrier.fleetAllocationLaterHint')}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {t('carrier.submitResponse')}
        </Button>
      </div>
    </form>
  );
}
