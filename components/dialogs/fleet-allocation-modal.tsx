'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignFleet } from '@/app/actions/transport';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n/context';

type Driver = { id: string; name: string; isAvailable: boolean };
type Vehicle = { id: string; plateNumber: string; isAvailable: boolean };

interface FleetAllocationModalProps {
  requestId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
}

export function FleetAllocationModal({ requestId, drivers, vehicles }: FleetAllocationModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const availableDrivers = drivers.filter((d) => d.isAvailable);
  const availableVehicles = vehicles.filter((v) => v.isAvailable);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('requestId', requestId);
    startTransition(async () => {
      const result = await assignFleet(formData);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? t('error.assignFleet'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t('shinwa.assignFleet')}</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('shinwa.fleetAllocation')}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicleId">{t('table.vehicle')}</Label>
            <Select id="vehicleId" name="vehicleId" required>
              <option value="">{t('shinwa.selectVehicle')}</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverId">{t('table.driver')}</Label>
            <Select id="driverId" name="driverId" required>
              <option value="">{t('shinwa.selectDriver')}</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t('shinwa.dispatching') : t('shinwa.dispatch')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
