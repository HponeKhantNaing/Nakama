'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/context';

const STEP_KEYS = [
  'PENDING',
  'ASSIGNED',
  'DISPATCHED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'CUSTOMER_CONFIRMED',
] as const;

function normalize(status: string, confirmed: boolean) {
  if (confirmed) return 'CUSTOMER_CONFIRMED';
  if (status === 'PENDING') return 'PENDING';
  if (status === 'ASSIGNED') return 'ASSIGNED';
  if (status === 'DISPATCHED') return 'DISPATCHED';
  if (status === 'PICKED_UP') return 'PICKED_UP';
  if (['IN_TRANSIT', 'ARRIVED', 'AWAITING_CONFIRMATION'].includes(status)) {
    return status === 'ARRIVED' || status === 'AWAITING_CONFIRMATION' ? 'ARRIVED' : 'IN_TRANSIT';
  }
  if (status === 'DELIVERED') return 'DELIVERED';
  return 'ASSIGNED';
}

export function DriverTimeline({
  status,
  confirmed,
  compact,
}: {
  status: string;
  confirmed: boolean;
  compact?: boolean;
}) {
  const { statusLabel } = useTranslation();
  const current = normalize(status, confirmed);
  const currentIdx = STEP_KEYS.findIndex((key) => key === current);

  return (
    <div className={cn('w-full', compact && 'scale-95')}>
      <div className="flex flex-wrap items-center gap-1.5">
        {STEP_KEYS.map((key, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs',
                  done && 'bg-emerald-100 text-emerald-700',
                  active && 'bg-primary text-white shadow-sm',
                  !done && !active && 'bg-muted/50 text-muted-foreground'
                )}
              >
                {statusLabel(key)}
              </div>
              {idx < STEP_KEYS.length - 1 && (
                <div className={cn('h-0.5 w-3 rounded-full sm:w-5', done ? 'bg-emerald-300' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
