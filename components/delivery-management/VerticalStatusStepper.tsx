'use client';

import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CUSTOMER_CONFIRMED', label: 'Customer Confirmed' },
] as const;

function normalize(status: string, confirmed: boolean) {
  if (confirmed) return 'CUSTOMER_CONFIRMED';
  if (status === 'PENDING') return 'PENDING';
  if (['SHINWA_ACCEPTED', 'SPLIT', 'DRIVER_ASSIGNED'].includes(status)) return 'ASSIGNED';
  if (status === 'DISPATCHED') return 'DISPATCHED';
  if (status === 'PICKED_UP') return 'PICKED_UP';
  if (['IN_TRANSIT', 'ARRIVED', 'AWAITING_CONFIRMATION'].includes(status)) return 'IN_TRANSIT';
  if (status === 'DELIVERED') return 'DELIVERED';
  return 'ASSIGNED';
}

export function VerticalStatusStepper({
  status,
  confirmed,
}: {
  status: string;
  confirmed: boolean;
}) {
  const current = normalize(status, confirmed);

  return (
    <div className="rounded-2xl bg-muted/20 p-4">
      <p className="text-xs font-semibold text-muted-foreground">Status</p>
      <div className="mt-3 space-y-3">
        {STEPS.map((s) => {
          const active = s.key === current;
          return (
            <div key={s.key} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 rounded-full',
                  active ? 'bg-primary shadow-[0_0_0_4px_rgba(255,107,74,0.15)]' : 'bg-border'
                )}
              />
              <div className="flex-1">
                <p className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {s.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

