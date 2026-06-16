'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  autoAssignFleet,
  createTruckAssignment,
  getAutoAllocationPlan,
} from '@/app/actions/fleet';
import { splitDelivery } from '@/app/actions/tms';
import { forwardToSubcontractor } from '@/app/actions/transport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

type Truck = {
  id: string;
  truckNo: string;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};

type Driver = { id: string; name: string; isAvailable: boolean };

type Assignment = {
  id: string;
  assignedWeight: number;
  assignedQuantity: number;
  status: string;
  truck?: { truckNo: string; truckType: string } | null;
  driver?: { name: string } | null;
};

interface FleetAllocationPanelProps {
  requestId: string;
  requestNo: string;
  totalWeight: number;
  totalQuantity: number;
  remainingWeight: number;
  remainingQuantity: number;
  trucks: Truck[];
  drivers: Driver[];
  assignments: Assignment[];
  subcontractors: { id: string; name: string }[];
}

export function FleetAllocationPanel({
  requestId,
  requestNo,
  totalWeight,
  totalQuantity,
  remainingWeight,
  remainingQuantity,
  trucks,
  drivers,
  assignments,
  subcontractors,
}: FleetAllocationPanelProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<{
    allocations: {
      truckId: string;
      truckNo: string;
      truckType: string;
      assignedWeight: number;
      assignedQuantity: number;
      remainingCapacityKg: number;
      remainingBoxes: number;
    }[];
    requiresSubcontract: boolean;
    subcontractSuggestion?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualTruck, setManualTruck] = useState('');
  const [manualDriver, setManualDriver] = useState('');
  const [manualWeight, setManualWeight] = useState(remainingWeight);
  const [manualQty, setManualQty] = useState(remainingQuantity);
  const [subcontractorId, setSubcontractorId] = useState('');

  // Keep manual defaults in sync as allocations change.
  useEffect(() => {
    setManualWeight(remainingWeight);
    setManualQty(remainingQuantity);
    setManualTruck('');
    setManualDriver('');
  }, [remainingWeight, remainingQuantity]);

  const availableTrucks = trucks.filter((t) => t.status === 'AVAILABLE');
  const availableDrivers = drivers.filter((d) => d.isAvailable);

  function truckLabel(type: string) {
    const key = `truck.${type}` as TranslationKey;
    const translated = t(key);
    return translated === key ? type.replace(/_/g, ' ') : translated;
  }

  const selectedTruck = useMemo(
    () => availableTrucks.find((t) => t.id === manualTruck) ?? null,
    [availableTrucks, manualTruck]
  );

  const perBoxWeight = useMemo(() => {
    if (remainingQuantity <= 0) return 0;
    return remainingWeight / remainingQuantity;
  }, [remainingQuantity, remainingWeight]);

  useEffect(() => {
    if (!selectedTruck) return;
    const qty = Math.max(1, Math.min(remainingQuantity, selectedTruck.maxBoxes));
    setManualQty(qty);
    const weight = perBoxWeight > 0 ? Math.min(remainingWeight, Math.round(perBoxWeight * qty)) : remainingWeight;
    setManualWeight(weight);
  }, [selectedTruck, remainingQuantity, remainingWeight, perBoxWeight]);

  function handlePreviewPlan() {
    startTransition(async () => {
      const result = await getAutoAllocationPlan(requestId);
      if (result.success && result.data) {
        setPlan(result.data as typeof plan);
      } else {
        setError(result.error ?? 'Failed to compute plan');
      }
    });
  }

  function handleAutoAssign() {
    setError(null);
    startTransition(async () => {
      const result = await autoAssignFleet(requestId);
      if (result.success) router.refresh();
      else setError(result.error ?? 'Auto assign failed');
    });
  }

  function handleManualAssign() {
    if (!manualTruck || !manualDriver) return;
    setError(null);
    startTransition(async () => {
      const result = await createTruckAssignment({
        requestId,
        truckId: manualTruck,
        driverId: manualDriver,
        assignedWeight: manualWeight,
        assignedQuantity: manualQty,
      });
      if (result.success) router.refresh();
      else setError(result.error ?? 'Manual assign failed');
    });
  }

  function handleSplit() {
    startTransition(async () => {
      const result = await splitDelivery(requestId, totalWeight * 0.6);
      if (result.success) router.refresh();
      else setError(result.error ?? 'Split failed');
    });
  }

  function handleSubcontract() {
    if (!subcontractorId) return;
    const fd = new FormData();
    fd.set('requestId', requestId);
    fd.set('subcontractorId', subcontractorId);
    startTransition(async () => {
      const result = await forwardToSubcontractor(fd);
      if (result.success) router.refresh();
      else setError(result.error ?? 'Subcontract failed');
    });
  }

  return (
    <Card className="rounded-2xl border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('shinwa.fleetAllocationPanel')}</CardTitle>
        <p className="text-xs text-muted-foreground">{requestNo}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.totalWeight')}</p>
            <p className="font-bold">{totalWeight} kg</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('form.totalBoxes')}</p>
            <p className="font-bold">{totalQuantity}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.remainingWeight')}</p>
            <p className="font-bold text-primary">{remainingWeight} kg</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.remainingBoxes')}</p>
            <p className="font-bold text-primary">{remainingQuantity}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.availableTrucks')}</p>
            <p className="font-bold">{availableTrucks.length}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.availableDrivers')}</p>
            <p className="font-bold">{availableDrivers.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={isPending} onClick={handlePreviewPlan}>
            {t('shinwa.previewAllocation')}
          </Button>
          <Button size="sm" disabled={isPending} onClick={handleAutoAssign}>
            {t('shinwa.autoAssign')}
          </Button>
          <Button size="sm" variant="secondary" disabled={isPending} onClick={handleSplit}>
            {t('shinwa.splitCargo')}
          </Button>
        </div>

        {plan && (
          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            <p className="text-xs font-semibold">{t('shinwa.allocationPlan')}</p>
            {plan.allocations.map((a) => (
              <div key={a.truckId} className="flex justify-between text-sm">
                <span>
                  {a.truckNo} ({truckLabel(a.truckType)})
                </span>
                <span className="text-muted-foreground">
                  {a.assignedQuantity} {t('form.boxes')} / {a.assignedWeight}kg — {a.remainingBoxes}{' '}
                  {t('form.boxes')} left
                </span>
              </div>
            ))}
            {plan.requiresSubcontract && (
              <p className="text-xs text-amber-600">{plan.subcontractSuggestion}</p>
            )}
          </div>
        )}

        {assignments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold">{t('shinwa.currentAssignments')}</p>
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{a.truck?.truckNo ?? '-'}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span>{a.driver?.name ?? '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {a.assignedQuantity} {t('form.boxes')} / {a.assignedWeight}kg
                  </span>
                  <Badge variant="secondary">{a.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-dashed p-3 md:grid-cols-2">
          <p className="text-xs font-semibold md:col-span-2">{t('shinwa.manualAssign')}</p>
          <div className="space-y-1">
            <Label>{t('table.vehicle')}</Label>
            <Select value={manualTruck} onChange={(e) => setManualTruck(e.target.value)}>
              <option value="">{t('shinwa.selectVehicle')}</option>
              {availableTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNo} — {truckLabel(t.truckType)} ({t.capacityWeightKg}kg, {t.maxBoxes}{' '}
                  boxes)
                </option>
              ))}
            </Select>
            {selectedTruck && remainingQuantity > 0 && selectedTruck.maxBoxes < remainingQuantity && (
              <p className="text-[11px] text-amber-600">
                This truck can carry up to {selectedTruck.maxBoxes} boxes. You’ll need another truck for the remaining{' '}
                {Math.max(0, remainingQuantity - selectedTruck.maxBoxes)}.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t('table.driver')}</Label>
            <Select value={manualDriver} onChange={(e) => setManualDriver(e.target.value)}>
              <option value="">{t('shinwa.selectDriver')}</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('form.boxes')}</Label>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              type="number"
              min={1}
              max={Math.min(remainingQuantity, selectedTruck?.maxBoxes ?? remainingQuantity)}
              value={manualQty}
              onChange={(e) => setManualQty(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('shinwa.assignedWeight') ?? 'Assigned Weight (kg)'}</Label>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              type="number"
              min={1}
              max={Math.min(remainingWeight, selectedTruck?.capacityWeightKg ?? remainingWeight)}
              value={manualWeight}
              onChange={(e) => setManualWeight(Number(e.target.value))}
            />
          </div>
          <Button
            size="sm"
            disabled={
              isPending ||
              !manualTruck ||
              !manualDriver ||
              manualQty <= 0 ||
              manualQty > remainingQuantity ||
              (selectedTruck != null && manualQty > selectedTruck.maxBoxes)
            }
            onClick={handleManualAssign}
          >
            {t('shinwa.manualAssign')}
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
          <div className="flex-1 space-y-1">
            <Label>{t('shinwa.forwardSubcontractor')}</Label>
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">{t('shinwa.selectSubcontractor')}</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={isPending || !subcontractorId} onClick={handleSubcontract}>
            {t('shinwa.subcontract')}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
