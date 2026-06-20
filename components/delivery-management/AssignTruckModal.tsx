'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTruckAssignment } from '@/app/actions/fleet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

type Truck = {
  id: string;
  truckNo: string | null;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};

type Driver = { id: string; name: string; isAvailable: boolean };

export function AssignTruckModal({
  open,
  onOpenChange,
  requestId,
  remainingQuantity,
  remainingWeight,
  trucks,
  drivers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  remainingQuantity: number;
  remainingWeight: number;
  trucks: Truck[];
  drivers: Driver[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [qty, setQty] = useState<number>(Math.max(1, remainingQuantity));
  const [weight, setWeight] = useState<number>(Math.max(1, remainingWeight));

  const availableTrucks = useMemo(
    () => trucks.filter((truck) => truck.status === 'AVAILABLE'),
    [trucks]
  );
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.isAvailable),
    [drivers]
  );
  const selectedTruck = useMemo(
    () => availableTrucks.find((truck) => truck.id === truckId) ?? null,
    [availableTrucks, truckId]
  );

  const perBoxWeight = useMemo(() => {
    if (remainingQuantity <= 0) return 0;
    return remainingWeight / remainingQuantity;
  }, [remainingQuantity, remainingWeight]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTruckId('');
    setDriverId('');
    setQty(Math.max(1, remainingQuantity));
    setWeight(Math.max(1, remainingWeight));
  }, [open, remainingQuantity, remainingWeight]);

  useEffect(() => {
    if (!selectedTruck) return;
    const nextQty = Math.max(1, Math.min(remainingQuantity, selectedTruck.maxBoxes));
    setQty(nextQty);
    const nextWeight =
      perBoxWeight > 0 ? Math.min(remainingWeight, Math.round(perBoxWeight * nextQty)) : remainingWeight;
    setWeight(nextWeight);
  }, [selectedTruck, remainingQuantity, remainingWeight, perBoxWeight]);

  function onSave() {
    if (!truckId || !driverId) return;
    setError(null);
    startTransition(async () => {
      const result = await createTruckAssignment({
        requestId,
        truckId,
        driverId,
        assignedQuantity: qty,
        assignedWeight: weight,
      });
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? t('shinwa.assignFailed'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('shinwa.manualTruckAssignment')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{t('table.vehicle')}</Label>
            <Select value={truckId} onChange={(e) => setTruckId(e.target.value)}>
              <option value="">{t('shinwa.selectTruck')}</option>
              {availableTrucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truckNo} ({truck.truckType}) — {truck.maxBoxes} {t('form.boxes')},{' '}
                  {truck.capacityWeightKg}kg
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('table.driver')}</Label>
            <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">{t('shinwa.selectDriver')}</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('shinwa.assignQuantity')}</Label>
              <Input
                type="number"
                min={1}
                max={Math.min(remainingQuantity, selectedTruck?.maxBoxes ?? remainingQuantity)}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                {interpolate(t('shinwa.remainingBoxesLabel'), { count: remainingQuantity })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('shinwa.assignWeight')}</Label>
              <Input
                type="number"
                min={1}
                max={Math.min(remainingWeight, selectedTruck?.capacityWeightKg ?? remainingWeight)}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                {interpolate(t('shinwa.remainingWeightLabel'), { weight: remainingWeight })}
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                isPending ||
                !truckId ||
                !driverId ||
                qty <= 0 ||
                qty > remainingQuantity ||
                (selectedTruck != null && qty > selectedTruck.maxBoxes)
              }
              onClick={onSave}
            >
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
