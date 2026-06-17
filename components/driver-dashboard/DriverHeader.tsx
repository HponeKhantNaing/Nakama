'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type DriverHeaderInfo = {
  name: string;
  truckNo?: string | null;
  truckType?: string | null;
  licenseType?: string | null;
  status: string;
  rating?: number | null;
};

function statusTone(status: string) {
  if (status === 'DRIVING' || status === 'ON_DELIVERY') return 'bg-blue-50 text-blue-700';
  if (status === 'AVAILABLE' || status === 'ONLINE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'OFFLINE') return 'bg-muted/40 text-muted-foreground';
  if (status === 'BREAK') return 'bg-amber-50 text-amber-700';
  return 'bg-muted/40 text-muted-foreground';
}

export function DriverHeader({ info }: { info: DriverHeaderInfo }) {
  const initials = useMemo(() => {
    const parts = info.name.split(' ').filter(Boolean);
    return (parts[0]?.[0] ?? 'D') + (parts[1]?.[0] ?? '');
  }, [info.name]);

  return (
    <Card className="sticky top-14 z-30 rounded-3xl border-border/60 bg-sidebar shadow-soft sm:top-16">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-bold">{info.name}</p>
            <Badge className={cn('rounded-xl border-0 px-3 py-1', statusTone(info.status))}>
              {info.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Truck: {info.truckNo ?? '—'}</span>
            <span>Type: {info.truckType ?? '—'}</span>
            <span>License: {info.licenseType ?? '—'}</span>
            {info.rating != null && <span>Rating: {info.rating.toFixed(1)}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

