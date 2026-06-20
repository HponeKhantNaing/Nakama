'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { updateDeliveryStatus } from '@/app/actions/transport';
import { updateAssignmentStatus, recordAssignmentProgress } from '@/app/actions/fleet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrackingMap } from '@/components/maps/tracking-map-wrapper';
import { useGpsSimulation } from '@/hooks/useGpsSimulation';
import { decodePolyline } from '@/lib/tms/routing';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { MapPin, Package, User, Navigation } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import type { LatLng } from '@/lib/tms/routing';

type ActiveJob = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  cargoType: string | null;
  cargoWeight: number;
  totalQuantity: number;
  status: string;
  expectedPickupDate: Date;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  routePolyline: string | null;
  routeDistanceKm: number | null;
  deliveryItems?: { quantity: number; product: { name: string } }[];
  tripAllocation?: {
    id?: string;
    driver: { name: string };
    vehicle?: { plateNumber: string } | null;
    truck?: { plateNumber: string; truckNo?: string | null } | null;
  } | null;
  truckAssignments?: {
    id: string;
    assignedWeight: number;
    assignedQuantity: number;
    status: string;
    dispatchedAt?: Date | null;
    pickedUpAt?: Date | null;
    arrivedAt?: Date | null;
    deliveredAt?: Date | null;
    truck?: { truckNo: string | null; plateNumber: string } | null;
    driver?: { name: string } | null;
    assignmentConfirmation?: {
      approved: boolean;
      approvedAt: Date | null;
      approvedBy: string | null;
      expiresAt: Date;
    } | null;
  }[];
};

interface DriverJobCardProps {
  job: ActiveJob;
}

export function DriverJobCard({ job }: DriverJobCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roadRoute, setRoadRoute] = useState<LatLng[] | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const assignment = job.truckAssignments?.[0];
  const assignmentId = assignment?.id;
  const confirmation = assignment?.assignmentConfirmation ?? null;

  const origin = useMemo(
    () => ({
      lat: job.originLat ?? 35.6762,
      lng: job.originLng ?? 139.6503,
    }),
    [job.originLat, job.originLng]
  );
  const destination = useMemo(
    () => ({
      lat: job.destLat ?? 34.6937,
      lng: job.destLng ?? 135.5023,
    }),
    [job.destLat, job.destLng]
  );

  useEffect(() => {
    if (job.routePolyline) {
      const decoded = decodePolyline(job.routePolyline);
      if (decoded.length >= 2) {
        setRoadRoute(decoded);
        return;
      }
    }
    fetch(`/api/requests/${job.id}/route`)
      .then((r) => r.json())
      .then((data) => {
        if (data.coordinates?.length >= 2) setRoadRoute(data.coordinates);
      })
      .catch(() => setRoadRoute([origin, destination]));
  }, [job.id, job.routePolyline, origin, destination]);

  const routeForSim = roadRoute && roadRoute.length >= 2 ? roadRoute : [origin, destination];

  const currentStatus = assignment?.status ?? job.status;
  const effectiveStatus = optimisticStatus ?? currentStatus;

  // Stop demo movement when the driver presses ARRIVED, but still render the map to the destination.
  const isTracking = effectiveStatus === 'DISPATCHED';
  const showMap = ['DISPATCHED', 'DELIVERED'].includes(effectiveStatus);

  const onTickRef = useRef<
    (s: {
      current: { lat: number; lng: number };
      progress: number;
      etaMinutes: number;
      heading: number;
      speed: number;
    }) => void
  >();

  onTickRef.current = (state) => {
    if (assignmentId) {
      recordAssignmentProgress(assignmentId, {
        latitude: state.current.lat,
        longitude: state.current.lng,
        speed: state.speed,
        heading: state.heading,
        progress: state.progress,
        etaMinutes: state.etaMinutes,
      });
    }
  };

  const { state: simState } = useGpsSimulation({
    enabled: isTracking && routeForSim.length >= 2,
    route: routeForSim,
    onTick: (s) => onTickRef.current?.(s),
  });

  const remainingKm =
    job.routeDistanceKm != null && simState
      ? job.routeDistanceKm * (1 - simState.progress / 100)
      : 0;

  function statusLabel(status: string): string {
    const key = `status.${status}` as TranslationKey;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  function handleStatusUpdate(status: 'DISPATCHED' | 'DELIVERED') {
    setError(null);
    startTransition(async () => {
      const result = assignmentId
        ? await updateAssignmentStatus(assignmentId, status)
        : await updateDeliveryStatus(job.id, status);

      if (result.success) {
        // If the driver manually marks DELIVERED, snap the map progress to the destination.
        if (assignmentId && status === 'DELIVERED') {
          await recordAssignmentProgress(assignmentId, {
            latitude: destination.lat,
            longitude: destination.lng,
            progress: 100,
            etaMinutes: 0,
            speed: 0,
            heading: 0,
          });
        }

        setOptimisticStatus(status);
        router.refresh();
      } else {
        setOptimisticStatus(null);
        setError(result.error ?? t('driver.updateError'));
      }
    });
  }

  const canStart = currentStatus === 'ASSIGNED' || currentStatus === 'DRIVER_ASSIGNED';
  const canDeliver = effectiveStatus === 'DISPATCHED';

  const truckLabel =
    assignment?.truck?.truckNo ??
    job.tripAllocation?.truck?.truckNo ??
    job.tripAllocation?.truck?.plateNumber ??
    job.tripAllocation?.vehicle?.plateNumber ??
    '-';

  const products =
    job.deliveryItems?.map((i) => `${i.product.name} ×${i.quantity}`).join(', ') ??
    job.cargoType ??
    'Cargo';

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{job.requestNo}</CardTitle>
          <Badge className={cn('rounded-lg font-normal', statusColor(currentStatus))}>
            {statusLabel(currentStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showMap && (
          <TrackingMap
            origin={origin}
            destination={destination}
            current={effectiveStatus === 'DELIVERED' ? destination : simState?.current}
            route={routeForSim}
            progressPercent={effectiveStatus === 'DELIVERED' ? 100 : simState?.progress ?? 0}
            remainingKm={effectiveStatus === 'DELIVERED' ? 0 : remainingKm}
            etaMinutes={effectiveStatus === 'DELIVERED' ? 0 : simState?.etaMinutes ?? 0}
            status={effectiveStatus}
            height="280px"
          />
        )}

        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">{t('driver.pickup')}</p>
              <p className="font-semibold">{job.origin}</p>
              <p className="text-xs text-muted-foreground">{formatDate(job.expectedPickupDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-semibold text-blue-700">{t('driver.destination')}</p>
              <p className="font-semibold">{job.destination}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
            <Package className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">{t('driver.cargo')}</p>
              <p className="font-semibold">
                {products} — {assignment?.assignedQuantity ?? job.totalQuantity}{' '}
                {t('form.boxes')}
                {assignment?.assignedWeight || job.cargoWeight
                  ? ` (${assignment?.assignedWeight ?? job.cargoWeight} kg)`
                  : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
              <AppLogo size="sm" />
              <div>
                <p className="text-xs text-muted-foreground">{t('table.vehicle')}</p>
                <p className="text-sm font-medium">{truckLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('table.driver')}</p>
                <p className="text-sm font-medium">
                  {assignment?.driver?.name ?? job.tripAllocation?.driver.name ?? '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {simState && (
          <div className="rounded-xl bg-primary/10 px-4 py-3">
            <div className="flex justify-between text-xs text-primary">
              <span>{t('driver.tripProgress')}</span>
              <span>
                {simState.progress}% · ETA {simState.etaMinutes} min
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/50">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${simState.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {canStart && (
            <Button
              size="lg"
              className="h-16 w-full rounded-2xl text-lg"
              disabled={isPending}
              onClick={() => handleStatusUpdate('DISPATCHED')}
            >
              {t('driver.startTrip')}
            </Button>
          )}
          {canDeliver && (
            <Button
              size="lg"
              className="h-16 w-full rounded-2xl bg-blue-600 text-lg hover:bg-blue-700"
              disabled={isPending}
              onClick={() => handleStatusUpdate('DELIVERED')}
            >
              {t('driver.confirmDelivery')}
            </Button>
          )}

          {/* Process records (real timestamps + confirmation state) */}
          {assignment && (
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-semibold text-muted-foreground">{t('driver.processRecords')}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t('driver.recordAssigned')}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(job.expectedPickupDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('driver.recordDispatched')}</span>
                  <span className="text-xs text-muted-foreground">
                    {assignment.dispatchedAt ? formatDate(assignment.dispatchedAt) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('driver.recordDelivered')}</span>
                  <span className="text-xs text-muted-foreground">
                    {assignment.deliveredAt ? formatDate(assignment.deliveredAt) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('driver.recordCustomerConfirm')}</span>
                  <span className="text-xs text-muted-foreground">
                    {confirmation?.approved
                      ? interpolate(t('driver.confirmApproved'), {
                          time: confirmation.approvedAt
                            ? formatDate(confirmation.approvedAt)
                            : t('driver.confirmNow'),
                        })
                      : confirmation
                        ? interpolate(t('driver.confirmWaiting'), {
                            time: formatDate(confirmation.expiresAt),
                          })
                        : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {isTracking && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
              <Navigation className="h-4 w-4 animate-pulse" />
              {t('driver.gpsSimulation')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
