'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTruckAssignment } from '@/app/actions/fleet';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

const navItems = [
  { href: '/subcontractor/assigned', labelKey: 'nav.assignedOrders' as const },
  { href: '/subcontractor/drivers', labelKey: 'nav.drivers' as const },
];

type Request = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  updatedAt: Date;
  cargoWeight: number;
  totalQuantity: number;
  tripAllocation?: {
    driver: { name: string };
    vehicle?: { plateNumber: string } | null;
    truck?: { plateNumber: string } | null;
  } | null;
};

type Driver = { id: string; name: string; isAvailable: boolean };
type Truck = {
  id: string;
  truckNo: string;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};

function AssignFleetButton({
  request,
  drivers,
  trucks,
}: {
  request: Request;
  drivers: Driver[];
  trucks: Truck[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const availableDrivers = drivers.filter((d) => d.isAvailable);
  const availableTrucks = trucks.filter((tr) => tr.status === 'AVAILABLE');

  function truckLabel(type: string) {
    const key = `truck.${type}` as TranslationKey;
    const translated = t(key);
    return translated === key ? type.replace(/_/g, ' ') : translated;
  }

  async function handleSubmit(formData: FormData) {
    const requestId = request.id;
    const truckId = formData.get('truckId');
    const driverId = formData.get('driverId');

    if (!truckId || !driverId) return;

    startTransition(async () => {
      const result = await createTruckAssignment({
        requestId,
        truckId,
        driverId,
        assignedWeight: request.cargoWeight,
        assignedQuantity: request.totalQuantity,
      });

      if (result.success) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t('subcontractor.assignDriver')}</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('subcontractor.assignDriverVehicle')}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="truckId">{t('table.vehicle')}</Label>
            <Select id="truckId" name="truckId" required>
              <option value="">{t('shinwa.selectVehicle')}</option>
              {availableTrucks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.truckNo} — {truckLabel(tr.truckType)} ({tr.maxBoxes} boxes)
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t('subcontractor.assigning') : t('subcontractor.assign')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubcontractorAssignedClient({
  requests,
  drivers,
  trucks,
}: {
  requests: Request[];
  drivers: Driver[];
  trucks: Truck[];
}) {
  return (
    <DashboardShell titleKey="dashboard.subcontractor" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="subcontractor.assignedOrders" />
        <StatusTable
          requests={requests}
          actions={(req) =>
            req.status === 'SUBCONTRACTED' ? (
              <AssignFleetButton request={req} drivers={drivers} trucks={trucks} />
            ) : null
          }
        />
      </div>
    </DashboardShell>
  );
}
