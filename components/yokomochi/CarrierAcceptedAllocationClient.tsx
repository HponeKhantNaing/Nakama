'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TruckType } from '@prisma/client';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  applyCarrierFleetAllocation,
  type CarrierAcceptedJobGroup,
} from '@/app/actions/carrier-fleet';
import {
  calcAllocatedBoxes,
  getYokomochiBoxCapacity,
} from '@/lib/yokomochi/vehicle-capacity';
import { formatFleetTripPlan } from '@/lib/yokomochi/carrier-fleet-plan';
import { useTranslation } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CarrierAssignedTripsTable } from '@/components/yokomochi/CarrierAssignedTripsTable';

type FleetDriver = { id: string; name: string; isAvailable: boolean };
type FleetTruck = {
  id: string;
  truckNo: string | null;
  truckNumber: string;
  truckType: TruckType;
  status: string;
};

type AllocationRow = {
  id: string;
  truckId: string;
  driverId: string;
  deliveryTimes: number;
};

function newRow(): AllocationRow {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    truckId: '',
    driverId: '',
    deliveryTimes: 1,
  };
}

function OrderAllocationCard({
  group,
  drivers,
  trucks,
}: {
  group: CarrierAcceptedJobGroup;
  drivers: FleetDriver[];
  trucks: FleetTruck[];
}) {
  const router = useRouter();
  const { t, formatDate, truckLabel } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<AllocationRow[]>([newRow()]);
  const [error, setError] = useState('');

  const pendingTrips = group.trips.filter((trip) => trip.status === 'CARRIER_ASSIGNED');
  const pendingTripCount =
    pendingTrips.length > 0 ? pendingTrips.length : group.eligibleTripCount;
  const pendingBoxes =
    pendingTrips.length > 0
      ? pendingTrips.reduce((sum, trip) => sum + trip.boxes, 0)
      : group.eligibleBoxes;

  const assignedOnOrderDriverIds = useMemo(
    () =>
      new Set(
        group.trips
          .filter(
            (trip) =>
              trip.driverTask &&
              !['COMPLETED', 'CANCELLED'].includes(trip.driverTask.status)
          )
          .map((trip) => trip.driverTask!.driver.id)
      ),
    [group.trips]
  );

  const assignedOnOrderTruckIds = useMemo(
    () =>
      new Set(
        group.trips
          .filter(
            (trip) =>
              trip.driverTask &&
              !['COMPLETED', 'CANCELLED'].includes(trip.driverTask.status) &&
              trip.driverTask.truck
          )
          .map((trip) => trip.driverTask!.truck!.id)
      ),
    [group.trips]
  );

  const tripPlanHint =
    pendingTripCount > 0 && group.driverCount > 0
      ? formatFleetTripPlan(pendingTripCount, group.driverCount)
      : null;

  const allocatedBoxes = useMemo(() => {
    return rows.reduce((sum, row) => {
      const truck = trucks.find((tr) => tr.id === row.truckId);
      if (!truck) return sum;
      return sum + calcAllocatedBoxes(truck.truckType, row.deliveryTimes);
    }, 0);
  }, [rows, trucks]);

  const remainingBoxes = pendingBoxes - allocatedBoxes;

  function driversForRow(rowId: string) {
    const usedInForm = rows
      .filter((r) => r.id !== rowId && r.driverId)
      .map((r) => r.driverId);
    return drivers.filter(
      (d) =>
        d.isAvailable &&
        !assignedOnOrderDriverIds.has(d.id) &&
        !usedInForm.includes(d.id)
    );
  }

  function trucksForRow(rowId: string) {
    const usedInForm = rows
      .filter((r) => r.id !== rowId && r.truckId)
      .map((r) => r.truckId);
    return trucks.filter(
      (tr) =>
        tr.status === 'AVAILABLE' &&
        !assignedOnOrderTruckIds.has(tr.id) &&
        !usedInForm.includes(tr.id)
    );
  }

  function addVehicleRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function updateRow(id: string, patch: Partial<AllocationRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function applyAllocation() {
    setError('');
    const validRows = rows.filter((r) => r.truckId && r.driverId && r.deliveryTimes >= 1);
    if (validRows.length === 0) {
      setError(t('carrier.allocationNeedRow'));
      return;
    }
    if (remainingBoxes > 0) {
      setError(`${t('carrier.allocationInsufficient')} (${remainingBoxes} ${t('carrier.boxes')})`);
      return;
    }
    if (pendingTripCount === 0) {
      setError(t('carrier.allTripsAssigned'));
      return;
    }

    startTransition(async () => {
      const result = await applyCarrierFleetAllocation({
        orderId: group.orderId,
        rows: validRows.map((r) => ({
          truckId: r.truckId,
          driverId: r.driverId,
          deliveryTimes: r.deliveryTimes,
        })),
      });
      if (!result.success) {
        setError(result.error ?? t('common.failed'));
        return;
      }
      setRows([newRow()]);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-0 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{group.orderNo}</p>
            <CardTitle className="text-lg">{t('carrier.fleetAllocation')}</CardTitle>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {group.requestedDate && (
                <p>
                  {t('carrier.requestedDate')}:{' '}
                  <span className="font-medium text-foreground">
                    {formatDate(group.requestedDate)}
                  </span>
                </p>
              )}
              {group.deliveryDate && (
                <p>
                  {t('carrier.deliveryDate')}:{' '}
                  <span className="font-medium text-foreground">
                    {formatDate(group.deliveryDate)}
                  </span>
                </p>
              )}
              {group.requestSentAt && (
                <p>
                  {t('carrier.requestSentAt')}: {formatDate(group.requestSentAt)}
                </p>
              )}
              {group.acceptedAt && (
                <p>
                  {t('carrier.acceptedAt')}: {formatDate(group.acceptedAt)}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline">
            {pendingTripCount} {t('carrier.tripsPending')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">{t('carrier.requestedCargoType')}</p>
          <p className="text-lg font-bold text-primary">{group.cargoType ?? '—'}</p>
          {(group.requestedDate || group.deliveryDate) && (
            <div className="mt-3 grid gap-3 border-b border-primary/10 pb-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{t('carrier.requestedDate')}</p>
                <p className="text-base font-semibold">
                  {group.requestedDate ? formatDate(group.requestedDate) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('carrier.deliveryDate')}</p>
                <p className="text-base font-semibold">
                  {group.deliveryDate ? formatDate(group.deliveryDate) : '—'}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t('carrier.totalOrderBoxes')}</p>
              <p className="text-xl font-bold">{group.totalRequestedBoxes}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('carrier.remainingBoxes')}</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  remainingBoxes > 0 && 'text-amber-600',
                  remainingBoxes <= 0 && 'text-green-600'
                )}
              >
                {Math.max(0, remainingBoxes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('carrier.allocatedBoxes')}</p>
              <p className="text-xl font-bold">{allocatedBoxes}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-primary/20 bg-muted/10 p-3 text-xs text-muted-foreground">
          <p>{t('carrier.capacityRulesTitle')}</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>{t('carrier.capacity10t')}</li>
            <li>{t('carrier.capacity4t')}</li>
            <li>{t('carrier.capacityVan')}</li>
          </ul>
          {tripPlanHint && (
            <p className="mt-2 text-foreground">
              {t('carrier.fleetPlan')}: <strong>{tripPlanHint}</strong>
            </p>
          )}
          {group.truckCount > 0 && (
            <p className="mt-1">
              {interpolate(t('carrier.respondedWith'), {
                trucks: group.truckCount,
                drivers: group.driverCount,
                trips: group.availableTrips,
              })}
            </p>
          )}
        </div>

        {pendingTripCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('carrier.sequentialVehicleAddition')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVehicleRow}>
                <Plus className="mr-1 h-4 w-4" />
                {t('carrier.addVehicleRow')}
              </Button>
            </div>

            {rows.map((row) => {
              const truck = trucks.find((tr) => tr.id === row.truckId);
              const rowBoxes = truck ? calcAllocatedBoxes(truck.truckType, row.deliveryTimes) : 0;
              const rowDrivers = driversForRow(row.id);
              const rowTrucks = trucksForRow(row.id);

              return (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">{t('carrier.selectVehicle')}</Label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={row.truckId}
                      onChange={(e) => updateRow(row.id, { truckId: e.target.value })}
                    >
                      <option value="">{t('shinwa.selectVehicle')}</option>
                      {rowTrucks.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.truckNo ?? tr.truckNumber} — {truckLabel(tr.truckType)} (
                          {getYokomochiBoxCapacity(tr.truckType)} {t('carrier.boxes')})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('carrier.selectDriver')}</Label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={row.driverId}
                      onChange={(e) => updateRow(row.id, { driverId: e.target.value })}
                    >
                      <option value="">{t('shinwa.selectDriver')}</option>
                      {rowDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('carrier.deliveryTimes')}</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.deliveryTimes > 0 ? String(row.deliveryTimes) : ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v === '') {
                          updateRow(row.id, { deliveryTimes: 0 });
                          return;
                        }
                        updateRow(row.id, { deliveryTimes: parseInt(v, 10) });
                      }}
                      onBlur={() => {
                        if (row.deliveryTimes < 1) {
                          updateRow(row.id, { deliveryTimes: 1 });
                        }
                      }}
                      className="w-20"
                    />
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted-foreground">{t('carrier.deducts')}</p>
                    <p className="font-bold text-primary">{rowBoxes}</p>
                  </div>
                  <div className="flex items-end pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isPending || remainingBoxes > 0}
              onClick={applyAllocation}
            >
              {isPending ? t('carrier.applying') : t('carrier.applyAllocation')}
            </Button>
            {remainingBoxes > 0 && (
              <p className="text-xs text-amber-600">
                {t('carrier.remainingBoxesHint')} ({remainingBoxes} {t('carrier.boxes')})
              </p>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}

export function CarrierAcceptedAllocationClient({
  jobGroups,
  drivers,
  trucks,
}: {
  jobGroups: CarrierAcceptedJobGroup[];
  drivers: FleetDriver[];
  trucks: FleetTruck[];
}) {
  const { t, formatDate, truckLabel } = useTranslation();

  if (jobGroups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('carrier.noAcceptedJobs')}
      </div>
    );
  }

  const pendingGroups = jobGroups.filter(
    (group) =>
      group.trips.some((trip) => trip.status === 'CARRIER_ASSIGNED') || group.eligibleTripCount > 0
  );

  return (
    <div className="space-y-6">
      <CarrierAssignedTripsTable groups={jobGroups} />

      {pendingGroups.map((group) => (
        <OrderAllocationCard
          key={group.orderId}
          group={group}
          drivers={drivers}
          trucks={trucks}
        />
      ))}
    </div>
  );
}
