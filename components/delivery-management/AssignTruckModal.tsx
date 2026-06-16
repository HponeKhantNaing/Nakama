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

type Truck = {
  id: string;
  truckNo: string;
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [qty, setQty] = useState<number>(Math.max(1, remainingQuantity));
  const [weight, setWeight] = useState<number>(Math.max(1, remainingWeight));

  const availableTrucks = useMemo(
    () => trucks.filter((t) => t.status === 'AVAILABLE'),
    [trucks]
  );
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.isAvailable),
    [drivers]
  );
  const selectedTruck = useMemo(
    () => availableTrucks.find((t) => t.id === truckId) ?? null,
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
        setError(result.error ?? 'Failed to assign');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manual Truck Assignment</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Truck</Label>
            <Select value={truckId} onChange={(e) => setTruckId(e.target.value)}>
              <option value="">Select truck</option>
              {availableTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNo} ({t.truckType}) — {t.maxBoxes} boxes, {t.capacityWeightKg}kg
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select driver</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Assign Quantity (boxes)</Label>
              <Input
                type="number"
                min={1}
                max={Math.min(remainingQuantity, selectedTruck?.maxBoxes ?? remainingQuantity)}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">Remaining: {remainingQuantity} boxes</p>
            </div>
            <div className="space-y-2">
              <Label>Assign Weight (kg)</Label>
              <Input
                type="number"
                min={1}
                max={Math.min(remainingWeight, selectedTruck?.capacityWeightKg ?? remainingWeight)}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">Remaining: {remainingWeight} kg</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
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
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

