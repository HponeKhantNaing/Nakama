'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { TrackingMapWrapper } from '@/components/maps/tracking-map-wrapper';
import { LatLng, calculateProgress } from '@/lib/tms/routing';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

import { shinwaNavItems } from '@/lib/nav/shinwa';

const navItems = shinwaNavItems;

interface TrackingData {
  requestNo: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  progressPercent: number;
  routeDurationMin: number;
  status: string;
  driver?: { currentLat: number | null; currentLng: number | null; name: string };
  route?: { lat: number; lng: number }[];
}

export function TrackingPageClient({ requestId }: { requestId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<TrackingData | null>(null);
  const [history, setHistory] = useState<LatLng[]>([]);

  const fetchTracking = useCallback(async () => {
    const [transportRes, gpsRes] = await Promise.all([
      fetch(`/api/transport?status=IN_TRANSIT`),
      fetch(`/api/gps?requestId=${requestId}`),
    ]);
    const transports = await transportRes.json();
    const gps = await gpsRes.json();
    const req = transports.find((r: { id: string }) => r.id === requestId);
    if (req) {
      setData({
        requestNo: req.requestNo,
        originLat: req.originLat ?? 35.6762,
        originLng: req.originLng ?? 139.6503,
        destLat: req.destLat ?? 35.1815,
        destLng: req.destLng ?? 136.9066,
        progressPercent: req.progressPercent ?? 0,
        routeDurationMin: req.routeDurationMin ?? 0,
        status: req.status,
        driver: req.tripAllocation?.driver,
      });
    }
    if (gps.history) {
      setHistory(gps.history.map((h: { latitude: number; longitude: number }) => ({
        lat: h.latitude,
        lng: h.longitude,
      })));
    }
    if (gps.current?.lat) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              driver: {
                name: prev.driver?.name ?? t('driver.defaultDriver'),
                currentLat: gps.current.lat,
                currentLng: gps.current.lng,
              },
            }
          : prev
      );
    }
  }, [requestId]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  const origin: LatLng = { lat: data?.originLat ?? 35.6762, lng: data?.originLng ?? 139.6503 };
  const destination: LatLng = { lat: data?.destLat ?? 35.1815, lng: data?.destLng ?? 136.9066 };
  const current: LatLng | undefined =
    data?.driver?.currentLat && data?.driver?.currentLng
      ? { lat: data.driver.currentLat, lng: data.driver.currentLng }
      : undefined;

  const { remainingKm } = current
    ? calculateProgress(origin, destination, current)
    : { remainingKm: 0 };

  const remainingMin = data
    ? Math.max(0, data.routeDurationMin * (1 - (data.progressPercent ?? 0) / 100))
    : 0;

  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="shinwa.incomingOrders" />
        <p className="text-sm text-muted-foreground">
          {interpolate(t('shinwa.liveGpsTracking'), { requestNo: data?.requestNo ?? requestId })}
        </p>
        <TrackingMapWrapper
          origin={origin}
          destination={destination}
          current={current}
          route={history}
          progressPercent={data?.progressPercent ?? 0}
          remainingKm={remainingKm}
          etaMinutes={remainingMin}
          status={data?.status ?? 'IN_TRANSIT'}
        />
      </div>
    </DashboardShell>
  );
}
