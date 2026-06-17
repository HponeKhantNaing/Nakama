'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import { RouteTrackingCard } from '@/components/driver-dashboard/RouteTrackingCard';
import { DeliveryTimeline } from '@/components/driver-dashboard/DeliveryTimeline';
import { CustomerQRCard } from '@/components/driver-dashboard/CustomerQRCard';
import { ProofOfDeliveryModal } from '@/components/driver-dashboard/ProofOfDeliveryModal';
import { useGpsSimulation } from '@/hooks/useGpsSimulation';
import { decodePolyline } from '@/lib/tms/routing';
import { updateAssignmentStatus, recordAssignmentProgress, rejectTruckAssignment } from '@/app/actions/fleet';
import { updateDeliveryStatus } from '@/app/actions/transport';
import type { LatLng } from '@/lib/tms/routing';
import { cn, statusColor, formatDate } from '@/lib/utils';
import { useOfflineActionQueue } from '@/hooks/useOfflineActionQueue';
import { MapPin, Package, Phone, Truck, ChevronDown, ChevronUp } from 'lucide-react';

const navItems = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' as const },
  { href: '/driver/history', labelKey: 'nav.history' as const },
];

type StepAction = 'DISPATCHED' | 'PICKED_UP' | 'ARRIVED' | 'DELIVERED';

function stepGuide(status: string, confirmed: boolean, t: (k: any) => string) {
  if (status === 'ASSIGNED' || status === 'PENDING') {
    return { hint: t('driver.stepAssigned'), action: 'DISPATCHED' as StepAction, label: t('driver.startTrip') };
  }
  if (status === 'DISPATCHED') {
    return { hint: t('driver.stepDispatched'), action: 'PICKED_UP' as StepAction, label: t('driver.pickedUp') };
  }
  if (status === 'PICKED_UP' || status === 'IN_TRANSIT') {
    return { hint: t('driver.stepInTransit'), action: 'ARRIVED' as StepAction, label: t('driver.confirmArrival') };
  }
  if (status === 'ARRIVED' || status === 'AWAITING_CONFIRMATION') {
    return {
      hint: confirmed ? t('driver.stepAwaiting') : t('driver.stepArrived'),
      action: 'DELIVERED' as StepAction,
      label: t('driver.confirmDelivery'),
      needsQr: !confirmed,
    };
  }
  return null;
}

export function DriverActiveJobClient({ data }: { data: any }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [podOpen, setPodOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);

  const driver = data.driver;
  const activeJob = data.activeJob;
  const assignment = activeJob?.truckAssignments?.[0] ?? null;
  const assignmentId = assignment?.id ?? null;

  const origin: LatLng = useMemo(
    () => ({ lat: activeJob?.originLat ?? 35.6762, lng: activeJob?.originLng ?? 139.6503 }),
    [activeJob?.originLat, activeJob?.originLng]
  );
  const destination: LatLng = useMemo(
    () => ({ lat: activeJob?.destLat ?? 34.6937, lng: activeJob?.destLng ?? 135.5023 }),
    [activeJob?.destLat, activeJob?.destLng]
  );

  const route = useMemo(() => {
    const decoded = activeJob?.routePolyline ? decodePolyline(activeJob.routePolyline) : [];
    return decoded.length >= 2 ? decoded : [origin, destination];
  }, [activeJob?.routePolyline, origin, destination]);

  const effectiveStatus = assignment?.status ?? activeJob?.status ?? 'PENDING';
  const trackingEnabled = ['DISPATCHED', 'PICKED_UP', 'IN_TRANSIT'].includes(effectiveStatus);

  const { state: simState } = useGpsSimulation({
    enabled: trackingEnabled && route.length >= 2,
    route,
    onTick: (s) => {
      if (!assignmentId) return;
      recordAssignmentProgress(assignmentId, {
        latitude: s.current.lat,
        longitude: s.current.lng,
        speed: s.speed,
        heading: s.heading,
        progress: s.progress,
        etaMinutes: s.etaMinutes,
      });
    },
  });

  const progressPercent =
    assignment?.deliveryProgress?.[0]?.progress ?? activeJob?.progressPercent ?? simState?.progress ?? 0;
  const etaMinutes = assignment?.deliveryProgress?.[0]?.etaMinutes ?? simState?.etaMinutes ?? null;
  const remainingKm =
    (activeJob?.routeDistanceKm ?? 0) > 0
      ? (activeJob.routeDistanceKm ?? 0) * (1 - progressPercent / 100)
      : 0;
  const current = effectiveStatus === 'DELIVERED' ? destination : simState?.current;

  const truckLabel =
    assignment?.truck?.truckNo ??
    activeJob?.tripAllocation?.truck?.truckNo ??
    activeJob?.tripAllocation?.truck?.plateNumber ??
    '—';

  const confirmed =
    assignment?.assignmentConfirmation?.approved ?? !!activeJob?.deliveryConfirmation?.approvedAt ?? false;

  const runQueued = useCallback(async (a: any) => {
    try {
      if (a.type === 'ASSIGNMENT_STATUS') {
        const r = await updateAssignmentStatus(a.assignmentId, a.status);
        return !!r.success;
      }
      if (a.type === 'REQUEST_STATUS') {
        const r = await updateDeliveryStatus(a.requestId, a.status);
        return !!r.success;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const { online, enqueue, pendingCount } = useOfflineActionQueue({ run: runQueued });

  function act(status: StepAction) {
    startTransition(async () => {
      if (!online) {
        if (assignmentId) enqueue({ type: 'ASSIGNMENT_STATUS', assignmentId, status });
        else enqueue({ type: 'REQUEST_STATUS', requestId: activeJob.id, status });
        return;
      }

      const result = assignmentId
        ? await updateAssignmentStatus(assignmentId, status)
        : await updateDeliveryStatus(activeJob.id, status);
      if (!result.success) return;

      if (assignmentId && (status === 'ARRIVED' || status === 'DELIVERED')) {
        await recordAssignmentProgress(assignmentId, {
          latitude: destination.lat,
          longitude: destination.lng,
          progress: 100,
          etaMinutes: 0,
          speed: 0,
          heading: 0,
        });
      }
      if (status === 'DELIVERED') setPodOpen(true);
      router.refresh();
    });
  }

  function rejectAssignment() {
    if (!assignmentId) return;
    startTransition(async () => {
      const result = await rejectTruckAssignment(assignmentId);
      if (!result.success) return;
      router.refresh();
    });
  }

  const step = stepGuide(effectiveStatus, confirmed, t);
  const canReject = ['ASSIGNED', 'PENDING'].includes(effectiveStatus) && !confirmed;
  const showMap = !['ASSIGNED', 'PENDING'].includes(effectiveStatus);
  const showQr = ['ARRIVED', 'AWAITING_CONFIRMATION'].includes(effectiveStatus);

  return (
    <DashboardShell titleKey="dashboard.driver" navItems={navItems}>
      <div className="mx-auto w-full max-w-lg space-y-4">
        {/* Mobile-first driver bar: wraps safely when driver/truck text is long. */}
        {driver && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{driver.name}</p>
              <p className="text-xs text-muted-foreground">
                {truckLabel} · {driver.licenseType?.replace(/_/g, ' ') ?? 'Driver'}
              </p>
            </div>
            <Badge className={cn('rounded-lg font-normal', online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {online ? 'Online' : 'Offline'}
            </Badge>
          </div>
        )}

        {!activeJob ? (
          <Card className="rounded-xl">
            <CardContent className="py-14 text-center">
              <p className="text-lg font-semibold">{t('driver.noActiveJob')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('driver.noActiveJobDesc')}</p>
              <Button asChild variant="outline" className="mt-6 rounded-xl">
                <Link href="/driver/history">{t('nav.history')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Job summary */}
            <Card className="rounded-xl">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{activeJob.requestNo}</p>
                    <p className="mt-1 break-words text-base font-bold">
                      {activeJob.origin} → {activeJob.destination}
                    </p>
                  </div>
                  <Badge className={cn('shrink-0 rounded-lg font-normal', statusColor(effectiveStatus))}>
                    {effectiveStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 break-words">
                      {assignment?.assignedQuantity ?? activeJob.totalQuantity} boxes ·{' '}
                      {Math.round(assignment?.assignedWeight ?? activeJob.cargoWeight)} kg
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 break-words">{truckLabel}</span>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('driver.pickup')}</p>
                      <p className="font-medium">{activeJob.origin}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(activeJob.expectedPickupDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('driver.destination')}</p>
                      <p className="font-medium">{activeJob.customer?.name ?? activeJob.destination}</p>
                      <p className="text-xs text-muted-foreground">{activeJob.customer?.address}</p>
                    </div>
                  </div>
                  {activeJob.customer?.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{activeJob.customer.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* What to do now */}
            {step && effectiveStatus !== 'DELIVERED' && (
              <Card className="rounded-xl border-primary/20 bg-primary/5">
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold">{t('driver.whatToDo')}</p>
                  <p className="text-sm text-muted-foreground">{step.hint}</p>
                  {pendingCount > 0 && (
                    <p className="text-xs text-amber-700">
                      {pendingCount} action(s) queued — will sync when online.
                    </p>
                  )}
                  <Button
                    className="h-12 w-full rounded-xl text-base"
                    disabled={isPending || !!(step as { needsQr?: boolean }).needsQr}
                    onClick={() => act(step.action)}
                  >
                    {step.label}
                  </Button>
                  {(step as { needsQr?: boolean }).needsQr && (
                    <p className="text-center text-xs text-muted-foreground">
                      Complete customer QR scan below first.
                    </p>
                  )}
                  {canReject && (
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
                      disabled={isPending}
                      onClick={rejectAssignment}
                    >
                      {t('driver.rejectAssignment')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <DeliveryTimeline status={effectiveStatus} confirmed={confirmed} />
              </CardContent>
            </Card>

            {/* QR — only when needed */}
            {showQr && (
              <CustomerQRCard
                requestId={activeJob.id}
                requestNo={activeJob.requestNo}
                assignmentId={assignmentId}
                confirmed={confirmed}
                expiresAt={assignment?.assignmentConfirmation?.expiresAt ?? null}
                canGenerate
              />
            )}

            {/* Map — collapsible */}
            {showMap && (
              <Card className="rounded-xl">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
                  onClick={() => setMapOpen((v) => !v)}
                >
                  {t('driver.tripProgress')}
                  {mapOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {mapOpen && (
                  <CardContent className="px-4 pb-4 pt-0">
                    <RouteTrackingCard
                      status={effectiveStatus}
                      origin={origin}
                      destination={destination}
                      current={current}
                      route={route}
                      progressPercent={effectiveStatus === 'DELIVERED' ? 100 : progressPercent}
                      remainingKm={effectiveStatus === 'DELIVERED' ? 0 : remainingKm}
                      etaMinutes={effectiveStatus === 'DELIVERED' ? 0 : etaMinutes}
                      speed={simState?.speed ?? null}
                    />
                  </CardContent>
                )}
              </Card>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/driver/history" className="underline-offset-2 hover:underline">
                {t('driver.viewHistory')}
              </Link>
            </p>

            <ProofOfDeliveryModal open={podOpen} onOpenChange={setPodOpen} requestId={activeJob.id} />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
