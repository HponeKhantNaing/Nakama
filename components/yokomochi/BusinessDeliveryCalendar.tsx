'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

type ScheduleLike = {
  id: string;
  scheduleNo: number;
  deliveryDate: Date | string;
  boxes: number;
  pallets: number;
  totalTrips: number;
  status: string;
};

type NegotiationLike = {
  requestedBoxes: number;
  availableBoxes: number;
  remainingBoxes: number;
  availableDate: Date | string;
  nextAvailableDate: Date | string | null;
  status: string;
};

export function BusinessDeliveryCalendar({
  requestedDate,
  requestedBoxes,
  negotiation,
  schedules,
}: {
  requestedDate: Date | string;
  requestedBoxes: number;
  negotiation?: NegotiationLike | null;
  schedules?: ScheduleLike[];
}) {
  const { t } = useTranslation();

  const items =
    schedules && schedules.length > 0
      ? schedules.map((s) => ({
          key: s.id,
          date: new Date(s.deliveryDate),
          boxes: s.boxes,
          label: interpolate(t('calendar.scheduleLabel'), { no: s.scheduleNo }),
          status: s.status,
          trips: s.totalTrips,
        }))
      : negotiation
        ? [
            {
              key: 'avail',
              date: new Date(negotiation.availableDate),
              boxes: negotiation.availableBoxes,
              label: t('calendar.factoryOffer'),
              status: negotiation.status,
              trips: null as number | null,
            },
            ...(negotiation.remainingBoxes > 0 && negotiation.nextAvailableDate
              ? [
                  {
                    key: 'remain',
                    date: new Date(negotiation.nextAvailableDate),
                    boxes: negotiation.remainingBoxes,
                    label: t('calendar.remaining'),
                    status: 'PENDING',
                    trips: null as number | null,
                  },
                ]
              : []),
          ]
        : [
            {
              key: 'req',
              date: new Date(requestedDate),
              boxes: requestedBoxes,
              label: t('calendar.requested'),
              status: 'REQUEST',
              trips: null as number | null,
            },
          ];

  const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="mb-3 text-sm font-semibold">{t('delivery.timelineTitle')}</p>
      <div className="relative space-y-0">
        {sorted.map((item, index) => (
          <div key={item.key} className="relative flex gap-4 pb-6 last:pb-0">
            {index < sorted.length - 1 && (
              <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
            )}
            <div
              className={cn(
                'relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-2',
                item.label === t('calendar.remaining')
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-primary bg-primary/10'
              )}
            />
            <div className="min-w-0 flex-1 rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{format(item.date, 'yyyy-MM-dd (EEE)')}</p>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className="mt-1 text-sm">
                {item.boxes} {t('form.boxes')}
                {item.trips != null ? ` · ${item.trips} ${t('yokomochi.trips')}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">{item.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
