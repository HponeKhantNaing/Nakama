'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrackingMap } from '@/components/maps/tracking-map-wrapper';
import { useTranslation } from '@/lib/i18n/context';
import { statusColor, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { decodePolyline } from '@/lib/tms/routing';
import type { TranslationKey } from '@/lib/i18n';

const POLL_MS = 5000;

const navItems = [
  { href: '/maruichi', labelKey: 'nav.requests' as const },
  { href: '/maruichi/monitor', labelKey: 'nav.monitor' as const },
  { href: '/maruichi/analytics', labelKey: 'nav.analytics' as const },
  { href: '/maruichi/history', labelKey: 'nav.history' as const },
];

type ActiveDelivery = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  progressPercent: number | null;
  eta: Date | null;
  routeDistanceKm: number | null;
  routePolyline: string | null;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  totalQuantity: number;
  handlerCompany?: { id: string; name: string } | null;
  subContractAssignment?: { subcontractor?: { id: string; name: string } | null } | null;
  tripAllocation?: {
    driver: { name: string; currentLat: number | null; currentLng: number | null };
    truck?: { truckNo: string | null } | null;
  } | null;
  truckAssignments?: {
    driver: { name: string; currentLat: number | null; currentLng: number | null };
    truck?: { truckNo: string | null } | null;
    deliveryProgress?: {
      latitude: number;
      longitude: number;
      progress: number;
      etaMinutes: number | null;
    }[];
  }[];
};

function resolveTracking(delivery: ActiveDelivery | undefined) {
  if (!delivery) return null;

  const assignment = delivery.truckAssignments?.[0];
  const driver = assignment?.driver ?? delivery.tripAllocation?.driver;
  const progressRecord = assignment?.deliveryProgress?.[0];
  const truckNo =
    assignment?.truck?.truckNo ?? delivery.tripAllocation?.truck?.truckNo ?? null;

  const origin = {
    lat: delivery.originLat ?? 35.6762,
    lng: delivery.originLng ?? 139.6503,
  };
  const destination = {
    lat: delivery.destLat ?? 34.6937,
    lng: delivery.destLng ?? 135.5023,
  };

  let route = delivery.routePolyline
    ? decodePolyline(delivery.routePolyline)
    : [origin, destination];
  if (route.length < 2) route = [origin, destination];

  const progress =
    progressRecord?.progress ??
    delivery.progressPercent ??
    0;

  const current =
    progressRecord != null
      ? { lat: progressRecord.latitude, lng: progressRecord.longitude }
      : driver?.currentLat != null && driver?.currentLng != null
        ? { lat: driver.currentLat, lng: driver.currentLng }
        : progress > 0
          ? route[Math.min(route.length - 1, Math.floor((progress / 100) * (route.length - 1)))]
          : origin;

  const etaMinutes = progressRecord?.etaMinutes ?? null;
  const totalKm = delivery.routeDistanceKm ?? 0;
  const remainingKm = totalKm > 0 ? totalKm * (1 - progress / 100) : 0;

  return {
    origin,
    destination,
    route,
    current,
    progress,
    etaMinutes,
    remainingKm,
    driver,
    truckNo,
  };
}

export function MaruichiMonitorClient({
  deliveries: initialDeliveries,
  filter: initialFilter,
}: {
  deliveries: ActiveDelivery[];
  filter: 'today' | 'in_transit' | 'delivered';
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDeliveries[0]?.id ?? null
  );

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  const selected =
    initialDeliveries.find((d) => d.id === selectedId) ?? initialDeliveries[0];
  const tracking = useMemo(() => resolveTracking(selected), [selected]);
  const carrierName =
    selected?.handlerCompany?.name ??
    selected?.subContractAssignment?.subcontractor?.name ??
    '-';

  function statusLabel(status: string): string {
    const key = `status.${status}` as TranslationKey;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  return (
    <DashboardShell titleKey="dashboard.maruichi" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="maruichi.fleetMonitor" />
        <p className="text-sm text-muted-foreground">{t('maruichi.monitorLiveNote')}</p>

        <div className="flex flex-wrap gap-2">
          {(['today', 'in_transit', 'delivered'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => {
                setFilter(f);
                window.location.href = `/maruichi/monitor?filter=${f}`;
              }}
            >
              {t(`maruichi.filter.${f}`)}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {initialDeliveries.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('maruichi.monitorEmpty')}
                </CardContent>
              </Card>
            ) : (
              initialDeliveries.map((d) => (
                <Card
                  key={d.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedId === d.id && 'border-primary'
                  )}
                  onClick={() => setSelectedId(d.id)}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{d.requestNo}</span>
                      <Badge className={cn('rounded-lg font-normal', statusColor(d.status))}>
                        {statusLabel(d.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.origin} → {d.destination}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Carrier: {d.handlerCompany?.name ?? d.subContractAssignment?.subcontractor?.name ?? '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.totalQuantity} {t('form.boxes')}
                    </p>
                    <div className="flex justify-between text-xs">
                      <span>
                        {t('table.driver')}:{' '}
                        {d.truckAssignments?.[0]?.driver?.name ??
                          d.tripAllocation?.driver?.name ??
                          '-'}
                      </span>
                      <span>{d.progressPercent ?? 0}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-4 lg:col-span-2">
            {selected && tracking ? (
              <>
                <TrackingMap
                  origin={tracking.origin}
                  destination={tracking.destination}
                  current={tracking.current}
                  route={tracking.route}
                  progressPercent={tracking.progress}
                  remainingKm={tracking.remainingKm}
                  etaMinutes={tracking.etaMinutes ?? 0}
                  status={selected.status}
                  height="420px"
                />
                <Card>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Carrier</p>
                      <p className="font-semibold">{carrierName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('table.driver')}</p>
                      <p className="font-semibold">{tracking.driver?.name ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('table.vehicle')}</p>
                      <p className="font-semibold">{tracking.truckNo ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ETA</p>
                      <p className="font-semibold">
                        {tracking.etaMinutes != null
                          ? `${tracking.etaMinutes} min`
                          : selected.eta
                            ? formatDate(selected.eta)
                            : '-'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t('maruichi.monitorSelectDelivery')}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
