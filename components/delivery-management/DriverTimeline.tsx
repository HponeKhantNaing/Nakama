'use client';

import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CUSTOMER_CONFIRMED', label: 'Customer Confirmed' },
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
  const current = normalize(status, confirmed);
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className={cn('w-full', compact && 'scale-95')}>
      <div className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs',
                  done && 'bg-emerald-100 text-emerald-700',
                  active && 'bg-primary text-white shadow-sm',
                  !done && !active && 'bg-muted/50 text-muted-foreground'
                )}
              >
                {s.label}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('h-0.5 w-3 rounded-full sm:w-5', done ? 'bg-emerald-300' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
