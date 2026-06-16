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
    <Card className="rounded-3xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Live Route Tracking</p>
            <p className="mt-1 text-xs text-muted-foreground">
              🚚────────────🏁 {Math.round(progressPercent)}% · ETA {etaMinutes != null ? `${Math.round(etaMinutes)}m` : '—'}
            </p>
          </div>
          <Badge className={cn('rounded-xl font-normal', statusColor(status))}>{status}</Badge>
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
            height="340px"
          />
        ) : (
          <div className="flex h-[340px] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
            Loading map...
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Distance remaining</p>
            <p className="mt-1 text-base font-bold">{remainingKm.toFixed(1)} km</p>
          </div>
          <div className="rounded-2xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Speed</p>
            <p className="mt-1 text-base font-bold">{speed != null ? `${Math.round(speed)} km/h` : '—'}</p>
          </div>
          <div className="rounded-2xl bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Progress</p>
            <p className="mt-1 text-base font-bold">{Math.round(progressPercent)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

