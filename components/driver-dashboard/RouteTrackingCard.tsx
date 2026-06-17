'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrackingMap } from '@/components/maps/tracking-map-wrapper';
import { cn, statusColor } from '@/lib/utils';
import type { LatLng } from '@/lib/tms/routing';

export function RouteTrackingCard({
  status,
  origin,
  destination,
  current,
  route,
  progressPercent,
  remainingKm,
  etaMinutes,
  speed,
}: {
  status: string;
  origin: LatLng;
  destination: LatLng;
  current: LatLng | undefined;
  route: LatLng[];
  progressPercent: number;
  remainingKm: number;
  etaMinutes: number | null;
  speed: number | null;
}) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMapReady(true);
    return () => setMapReady(false);
  }, []);

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-3 p-4">
        {/* Header stacks on phones so long status text never squeezes the map controls. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Live Route Tracking</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              🚚────────────🏁 {Math.round(progressPercent)}% · ETA {etaMinutes != null ? `${Math.round(etaMinutes)}m` : '—'}
            </p>
          </div>
          <Badge className={cn('w-fit rounded-lg font-normal', statusColor(status))}>{status}</Badge>
        </div>

        {mapReady && route.length >= 2 ? (
          <TrackingMap
            origin={origin}
            destination={destination}
            current={current}
            route={route}
            progressPercent={progressPercent}
            remainingKm={remainingKm}
            etaMinutes={etaMinutes ?? 0}
            status={status}
            height="clamp(280px, 70vw, 340px)"
          />
        ) : (
          <div className="flex h-[clamp(280px,70vw,340px)] items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground">
            Loading map...
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Distance remaining</p>
            <p className="mt-1 text-base font-bold">{remainingKm.toFixed(1)} km</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Speed</p>
            <p className="mt-1 text-base font-bold">{speed != null ? `${Math.round(speed)} km/h` : '—'}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Progress</p>
            <p className="mt-1 text-base font-bold">{Math.round(progressPercent)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

