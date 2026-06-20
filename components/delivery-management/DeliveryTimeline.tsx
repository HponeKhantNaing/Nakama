'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/context';

const STEP_KEYS = [
  'PENDING',
  'ASSIGNED',
  'DISPATCHED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CUSTOMER_CONFIRMED',
] as const;

function normalize(status: string, confirmed: boolean) {
  if (confirmed) return 'CUSTOMER_CONFIRMED';
  if (status === 'PENDING') return 'PENDING';
  if (['SHINWA_ACCEPTED', 'SPLIT', 'DRIVER_ASSIGNED'].includes(status)) return 'ASSIGNED';
  if (status === 'DISPATCHED') return 'DISPATCHED';
  if (status === 'PICKED_UP') return 'PICKED_UP';
  if (['IN_TRANSIT', 'ARRIVED', 'AWAITING_CONFIRMATION'].includes(status)) return 'IN_TRANSIT';
  if (status === 'DELIVERED') return 'DELIVERED';
  if (status === 'CANCELLED') return 'PENDING';
  return 'ASSIGNED';
}

export function DeliveryTimeline({
  status,
  confirmed,
}: {
  status: string;
  confirmed: boolean;
}) {
  const { statusLabel } = useTranslation();
  const current = normalize(status, confirmed);
  const currentIdx = STEP_KEYS.findIndex((key) => key === current);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEP_KEYS.map((key, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={key} className="flex min-w-max items-center gap-2">
              <div
                className={cn(
                  'flex h-7 items-center rounded-full px-3 text-xs font-semibold',
                  done && 'bg-emerald-100 text-emerald-700',
                  active && 'bg-primary/15 text-primary',
                  !done && !active && 'bg-muted/40 text-muted-foreground'
                )}
              >
                {statusLabel(key)}
              </div>
              {idx < STEP_KEYS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-8 rounded-full',
                    done ? 'bg-emerald-300' : 'bg-border'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
