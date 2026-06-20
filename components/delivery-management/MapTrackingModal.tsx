'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TrackingMap } from '@/components/maps/tracking-map-wrapper';
import { decodePolyline } from '@/lib/tms/routing';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

type LatLng = { lat: number; lng: number };

export function MapTrackingModal({
  open,
  onOpenChange,
  requestNo,
  origin,
  destination,
  originLat,
  originLng,
  destLat,
  destLng,
  routePolyline,
  routeDistanceKm,
  progressPercent,
  currentLat,
  currentLng,
  etaMinutes,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestNo: string;
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  routePolyline: string | null;
  routeDistanceKm: number | null;
  progressPercent: number | null;
  currentLat: number | null;
  currentLng: number | null;
  etaMinutes: number | null;
  status: string;
}) {
  const { t, statusLabel } = useTranslation();

  const o = useMemo(
    () => ({ lat: originLat ?? 35.6762, lng: originLng ?? 139.6503 }),
    [originLat, originLng]
  );
  const d = useMemo(
    () => ({ lat: destLat ?? 34.6937, lng: destLng ?? 135.5023 }),
    [destLat, destLng]
  );

  const route = useMemo(() => {
    const decoded = routePolyline ? decodePolyline(routePolyline) : [];
    return decoded.length >= 2 ? decoded : [o, d];
  }, [routePolyline, o, d]);

  const current = useMemo<LatLng>(() => {
    if (currentLat != null && currentLng != null) return { lat: currentLat, lng: currentLng };
    if (progressPercent != null && progressPercent > 0) {
      const idx = Math.min(route.length - 1, Math.floor((progressPercent / 100) * (route.length - 1)));
      return route[idx] ?? o;
    }
    return o;
  }, [currentLat, currentLng, progressPercent, route, o]);

  const remainingKm = useMemo(() => {
    const total = routeDistanceKm ?? 0;
    const p = progressPercent ?? 0;
    return total > 0 ? total * (1 - p / 100) : 0;
  }, [routeDistanceKm, progressPercent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {interpolate(t('map.trackRouteTitle'), { requestNo, origin, destination })}
          </DialogTitle>
        </DialogHeader>
        {open && route.length >= 2 ? (
          <TrackingMap
            origin={o}
            destination={d}
            current={current}
            route={route}
            progressPercent={progressPercent ?? 0}
            remainingKm={remainingKm}
            etaMinutes={etaMinutes ?? 0}
            status={status}
            height="520px"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
