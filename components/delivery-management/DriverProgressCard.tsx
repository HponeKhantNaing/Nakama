'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, statusColor } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { DriverTimeline } from './DriverTimeline';
import { CustomerConfirmationCard } from './CustomerConfirmationCard';
import { MapPin, Navigation } from 'lucide-react';

export type DriverAssignmentProgress = {
  id: string;
  status: string;
  assignedWeight: number;
  assignedQuantity: number;
  truck?: { truckNo: string | null; truckType: string; plateNumber: string } | null;
  driver?: { name: string; phone?: string | null } | null;
  deliveryProgress?: {
    latitude: number;
    longitude: number;
    progress: number;
    etaMinutes: number | null;
    speed?: number | null;
  }[];
  assignmentConfirmation?: {
    approved: boolean;
    approvedAt?: Date | null;
    approvedBy?: string | null;
    expiresAt?: Date;
  } | null;
};

function deliveredQty(a: DriverAssignmentProgress) {
  return a.status === 'DELIVERED' ? a.assignedQuantity : 0;
}

function deliveredWeight(a: DriverAssignmentProgress) {
  return a.status === 'DELIVERED' ? a.assignedWeight : 0;
}

function tripProgress(a: DriverAssignmentProgress) {
  if (a.status === 'DELIVERED') return 100;
  return a.deliveryProgress?.[0]?.progress ?? 0;
}

export function DriverProgressCard({
  assignment,
  index,
  onCancel,
  canCancel,
  isCancelling,
}: {
  assignment: DriverAssignmentProgress;
  index: number;
  onCancel?: () => void;
  canCancel?: boolean;
  isCancelling?: boolean;
}) {
  const { t, statusLabel, truckLabel } = useTranslation();
  const isCancelled = assignment.status === 'CANCELLED';
  const driverName =
    assignment.driver?.name ??
    interpolate(t('driverProgress.driverIndex'), { index: index + 1 });
  const truckNo = assignment.truck?.truckNo ?? assignment.truck?.plateNumber ?? '—';
  const truckType = assignment.truck?.truckType ?? '—';
  const progress = assignment.deliveryProgress?.[0];
  const tripPct = tripProgress(assignment);
  const delBoxes = deliveredQty(assignment);
  const delWeight = deliveredWeight(assignment);
  const confirmed = assignment.assignmentConfirmation?.approved ?? false;

  const boxPct =
    assignment.assignedQuantity > 0
      ? Math.round((delBoxes / assignment.assignedQuantity) * 100)
      : assignment.status === 'DELIVERED'
        ? 100
        : Math.round(tripPct);

  const tripSuffix =
    assignment.status !== 'DELIVERED' && tripPct > 0
      ? interpolate(t('driverProgress.tripPct'), { pct: Math.round(tripPct) })
      : '';

  return (
    <Card className={cn('rounded-3xl border-border/60 bg-white shadow-soft', isCancelled && 'opacity-60')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
              {driverName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{driverName}</p>
              <p className="text-xs text-muted-foreground">
                {truckNo} · {truckType !== '—' ? truckLabel(truckType) : '—'}
              </p>
            </div>
          </div>
          <Badge className={cn('rounded-xl font-normal', statusColor(assignment.status))}>
            {statusLabel(assignment.status)}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/20 p-3 text-sm">
            <p className="text-[11px] text-muted-foreground">{t('table.boxes')}</p>
            <p className="font-semibold">
              {delBoxes} / {assignment.assignedQuantity}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 p-3 text-sm">
            <p className="text-[11px] text-muted-foreground">{t('driverProgress.weightKg')}</p>
            <p className="font-semibold">
              {Math.round(delWeight)} / {Math.round(assignment.assignedWeight)}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">
              {interpolate(t('driverProgress.boxesProgress'), {
                delivered: delBoxes,
                total: assignment.assignedQuantity,
                trip: tripSuffix,
              })}
            </span>
            <span className="font-semibold">{boxPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, boxPct)}%` }}
            />
          </div>
        </div>

        {(progress || assignment.driver?.phone) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {progress && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {progress.latitude.toFixed(4)}, {progress.longitude.toFixed(4)}
              </span>
            )}
            {progress?.etaMinutes != null && (
              <span className="inline-flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5" />
                {interpolate(t('driverProgress.etaMin'), { min: Math.round(progress.etaMinutes) })}
              </span>
            )}
            {progress?.speed != null && (
              <span>{interpolate(t('driverProgress.speedKmh'), { speed: Math.round(progress.speed) })}</span>
            )}
          </div>
        )}

        <DriverTimeline status={assignment.status} confirmed={confirmed} compact />

        <CustomerConfirmationCard
          driverName={driverName}
          truckNo={truckNo}
          hasConfirmation={!!assignment.assignmentConfirmation}
          approved={confirmed}
          approvedAt={assignment.assignmentConfirmation?.approvedAt ?? null}
          approvedBy={assignment.assignmentConfirmation?.approvedBy ?? null}
          expiresAt={assignment.assignmentConfirmation?.expiresAt ?? null}
        />

        {canCancel && onCancel && !isCancelled && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full rounded-xl"
            disabled={isCancelling}
            onClick={onCancel}
          >
            {t('driverProgress.cancelAssignment')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
