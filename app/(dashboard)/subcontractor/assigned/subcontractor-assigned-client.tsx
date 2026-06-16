'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { subcontractorAssignFleet } from '@/app/actions/transport';
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
  tripAllocation?: {
    driver: { name: string };
    vehicle: { plateNumber: string };
  } | null;
};

type Driver = { id: string; name: string };
type Vehicle = { id: string; plateNumber: string };

function AssignFleetButton({
  requestId,
  drivers,
  vehicles,
}: {
  requestId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    formData.set('requestId', requestId);
    startTransition(async () => {
      const result = await subcontractorAssignFleet(formData);
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
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleId">{t('table.vehicle')}</Label>
            <Select id="vehicleId" name="vehicleId" required>
              <option value="">{t('shinwa.selectVehicle')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber}
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
  vehicles,
}: {
  requests: Request[];
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  return (
    <DashboardShell titleKey="dashboard.subcontractor" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="subcontractor.assignedOrders" />
        <StatusTable
          requests={requests}
          actions={(req) =>
            req.status === 'SUBCONTRACTED' ? (
              <AssignFleetButton requestId={req.id} drivers={drivers} vehicles={vehicles} />
            ) : null
          }
        />
      </div>
    </DashboardShell>
  );
}
