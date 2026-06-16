'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { autoAssignFleet, cancelTruckAssignment } from '@/app/actions/fleet';
import { acceptOrder, rejectOrder } from '@/app/actions/transport';
import { canCancelAssignment } from '@/lib/tms/request-compute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, statusColor, formatDate } from '@/lib/utils';
import { AssignTruckModal } from './AssignTruckModal';
import { DriverProgressCard } from './DriverProgressCard';
import { TrackingMap } from '@/components/maps/tracking-map-wrapper';
import { decodePolyline } from '@/lib/tms/routing';
import type { LatLng } from '@/lib/tms/routing';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Assignment = {
  id: string;
  assignedWeight: number;
  assignedQuantity: number;
  status: string;
  truck?: { truckNo: string | null; truckType: string; plateNumber: string } | null;
  driver?: { name: string } | null;
  deliveryProgress?: { latitude: number; longitude: number; progress: number; etaMinutes: number | null }[];
  assignmentConfirmation?: {
    approved: boolean;
    approvedAt?: Date | null;
    approvedBy?: string | null;
    expiresAt?: Date;
  } | null;
};

type BoardRequest = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date | null;
  cargoType: string | null;
  cargoWeight: number;
  totalQuantity: number;
  progressPercent: number | null;
  routePolyline: string | null;
  routeDistanceKm: number | null;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  truckAssignments?: Assignment[];
  computedStatus?: string;
  computedProgress?: number;
  remainingQuantity?: number;
  deliveredQuantity?: number;
  remainingWeight?: number;
  deliveredWeight?: number;
  allocationRemainingQuantity?: number;
  allocationRemainingWeight?: number;
  isFullyAllocated?: boolean;
  customer?: { name: string; address: string; phone: string | null } | null;
};

type Truck = {
  id: string;
  truckNo: string;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};
type Driver = { id: string; name: string; isAvailable: boolean };

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

export function RequestAccordion({
  requests,
  trucks,
  drivers,
  variant = 'active',
}: {
  requests: BoardRequest[];
  trucks: Truck[];
  drivers: Driver[];
  subcontractors?: { id: string; name: string }[];
  variant?: 'active' | 'delivered';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<null | { requestId: string; remainingQty: number; remainingWeight: number }>(
    null
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const readOnly = variant === 'delivered';

  function activeAssignments(req: BoardRequest) {
    return (req.truckAssignments ?? []).filter((a) => a.status !== 'CANCELLED');
  }

  function activeAssignedQty(req: BoardRequest) {
    return activeAssignments(req).reduce((s, a) => s + (a.assignedQuantity ?? 0), 0);
  }

  function activeAssignedWeight(req: BoardRequest) {
    return activeAssignments(req).reduce((s, a) => s + (a.assignedWeight ?? 0), 0);
  }

  function onAutoAssign(id: string) {
    startTransition(async () => {
      await autoAssignFleet(id);
      router.refresh();
    });
  }

  function onAccept(id: string) {
    startTransition(async () => {
      await acceptOrder(id);
      router.refresh();
    });
  }

  function onReject(id: string) {
    startTransition(async () => {
      await rejectOrder(id);
      router.refresh();
    });
  }

  function onCancelAssignment(assignmentId: string) {
    setCancellingId(assignmentId);
    startTransition(async () => {
      await cancelTruckAssignment(assignmentId);
      setCancellingId(null);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No requests found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* Header */}
      <div className="hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[110px_1fr_72px_120px_64px_32px] md:gap-3">
        <span>Request</span>
        <span>Route</span>
        <span>Boxes</span>
        <span>Status</span>
        <span>Progress</span>
        <span />
      </div>

      {requests.map((req) => {
        const expanded = expandedId === req.id;
        const effectiveStatus = req.computedStatus ?? req.status;
        const progress = req.computedProgress ?? req.progressPercent ?? 0;
        const allocRemainingQty =
          req.allocationRemainingQuantity ?? Math.max(0, req.totalQuantity - activeAssignedQty(req));
        const allocRemainingWeight =
          req.allocationRemainingWeight ?? Math.max(0, req.cargoWeight - activeAssignedWeight(req));
        const isFullyAllocated = req.isFullyAllocated ?? allocRemainingQty <= 0;
        const driverNames = activeAssignments(req)
          .map((a) => a.driver?.name)
          .filter(Boolean)
          .join(', ');

        return (
          <div key={req.id} className="border-b last:border-b-0">
            {/* Collapsed row */}
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30',
                expanded && 'bg-muted/20'
              )}
              onClick={() => setExpandedId(expanded ? null : req.id)}
            >
              <span className="hidden w-[110px] shrink-0 font-mono text-xs font-medium md:block">
                {req.requestNo}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-muted-foreground md:hidden">{req.requestNo}</p>
                <p className="truncate text-sm font-medium">
                  {req.origin} → {req.destination}
                </p>
                {driverNames && (
                  <p className="truncate text-xs text-muted-foreground">{driverNames}</p>
                )}
              </div>
              <span className="hidden w-[72px] shrink-0 text-sm tabular-nums md:block">{req.totalQuantity}</span>
              <span className="hidden w-[120px] shrink-0 md:block">
                <Badge className={cn('rounded-lg text-[10px] font-normal', statusColor(effectiveStatus))}>
                  {statusLabel(effectiveStatus)}
                </Badge>
              </span>
              <span className="hidden w-[64px] shrink-0 text-sm font-medium tabular-nums md:block">
                {Math.round(progress)}%
              </span>
              <span className="shrink-0 text-muted-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            </button>

            {/* Mobile meta */}
            <div className="flex flex-wrap gap-2 px-4 pb-2 md:hidden">
              <Badge className={cn('rounded-lg text-[10px] font-normal', statusColor(effectiveStatus))}>
                {statusLabel(effectiveStatus)}
              </Badge>
              <span className="text-xs text-muted-foreground">{req.totalQuantity} boxes · {Math.round(progress)}%</span>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cargo</p>
                    <p className="font-medium">{req.cargoType ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.totalQuantity} boxes · {req.cargoWeight} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-medium">{req.customer?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{req.customer?.phone ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(req.createdAt)}</p>
                  </div>
                  {readOnly && req.deliveredAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                      <p className="font-medium">{formatDate(req.deliveredAt)}</p>
                    </div>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap gap-2">
                    {req.status === 'PENDING' && (
                      <>
                        <Button size="sm" disabled={isPending} onClick={() => onAccept(req.id)}>
                          Accept
                        </Button>
                        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => onReject(req.id)}>
                          Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" disabled={isPending || isFullyAllocated} onClick={() => onAutoAssign(req.id)}>
                      Auto Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || isFullyAllocated}
                      onClick={() =>
                        setAssignFor({
                          requestId: req.id,
                          remainingQty: allocRemainingQty,
                          remainingWeight: allocRemainingWeight,
                        })
                      }
                    >
                      Manual Assign
                    </Button>
                  </div>
                )}

                {!readOnly && isFullyAllocated && (
                  <p className="text-xs text-muted-foreground">
                    Fully assigned. Cancel an unconfirmed assignment to free capacity.
                  </p>
                )}

                {activeAssignments(req).length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {activeAssignments(req).map((a, idx) => (
                      <DriverProgressCard
                        key={a.id}
                        assignment={a}
                        index={idx}
                        canCancel={!readOnly && canCancelAssignment(a)}
                        isCancelling={cancellingId === a.id}
                        onCancel={
                          !readOnly && canCancelAssignment(a) ? () => onCancelAssignment(a.id) : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  !readOnly && (
                    <p className="text-sm text-muted-foreground">No drivers assigned yet.</p>
                  )
                )}

                {!readOnly && (
                  <div className="overflow-hidden rounded-xl border bg-white">
                    {(() => {
                      const o: LatLng = { lat: req.originLat ?? 35.6762, lng: req.originLng ?? 139.6503 };
                      const d: LatLng = { lat: req.destLat ?? 34.6937, lng: req.destLng ?? 135.5023 };
                      const decoded = req.routePolyline ? decodePolyline(req.routePolyline) : [];
                      const route = decoded.length >= 2 ? decoded : [o, d];
                      const best =
                        activeAssignments(req).find((a) => a.deliveryProgress?.[0]) ??
                        activeAssignments(req)[0];
                      const p = best?.deliveryProgress?.[0];
                      const current = p ? { lat: p.latitude, lng: p.longitude } : o;
                      const km = req.routeDistanceKm ?? 0;
                      const remainingKm = km > 0 ? km * (1 - Math.min(100, Math.round(progress)) / 100) : 0;
                      return (
                        <TrackingMap
                          origin={o}
                          destination={d}
                          current={current}
                          route={route}
                          progressPercent={Math.round(progress)}
                          remainingKm={remainingKm}
                          etaMinutes={p?.etaMinutes ?? 0}
                          status={effectiveStatus}
                          height="280px"
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <AssignTruckModal
        open={assignFor != null}
        onOpenChange={(o) => !o && setAssignFor(null)}
        requestId={assignFor?.requestId ?? ''}
        remainingQuantity={assignFor?.remainingQty ?? 0}
        remainingWeight={assignFor?.remainingWeight ?? 0}
        trucks={trucks}
        drivers={drivers}
      />
    </div>
  );
}
