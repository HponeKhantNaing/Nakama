'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateDeliveryStatus } from '@/app/actions/transport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, statusColor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { MapPin, Package, Truck, User } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

type ActiveJob = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  cargoType: string;
  cargoWeight: number;
  status: string;
  expectedPickupDate: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle: { plateNumber: string };
  } | null;
};

interface DriverJobCardProps {
  job: ActiveJob;
}

export function DriverJobCard({ job }: DriverJobCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function statusLabel(status: string): string {
    const key = `status.${status}` as TranslationKey;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  function handleStatusUpdate(status: 'DISPATCHED' | 'PICKED_UP' | 'DELIVERED') {
    setError(null);
    startTransition(async () => {
      const result = await updateDeliveryStatus(job.id, status);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? t('driver.updateError'));
      }
    });
  }

  const canDispatch = job.status === 'DRIVER_ASSIGNED';
  const canPickUp = job.status === 'DISPATCHED';
  const canDeliver = job.status === 'PICKED_UP';

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{job.requestNo}</CardTitle>
          <Badge className={cn('rounded-lg font-normal', statusColor(job.status))}>
            {statusLabel(job.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">{t('driver.pickup')}</p>
              <p className="font-semibold">{job.origin}</p>
              <p className="text-xs text-muted-foreground">{formatDate(job.expectedPickupDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-semibold text-blue-700">{t('driver.destination')}</p>
              <p className="font-semibold">{job.destination}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
            <Package className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">{t('driver.cargo')}</p>
              <p className="font-semibold">
                {job.cargoType} — {job.cargoWeight} kg
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('table.vehicle')}</p>
                <p className="text-sm font-medium">
                  {job.tripAllocation?.vehicle.plateNumber ?? '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('table.driver')}</p>
                <p className="text-sm font-medium">
                  {job.tripAllocation?.driver.name ?? '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3 pt-2">
          {canDispatch && (
            <Button
              size="xl"
              className="h-16 w-full rounded-2xl text-lg"
              disabled={isPending}
              onClick={() => handleStatusUpdate('DISPATCHED')}
            >
              {t('driver.startTrip')}
            </Button>
          )}
          {canPickUp && (
            <Button
              size="xl"
              variant="secondary"
              className="h-16 w-full rounded-2xl text-lg"
              disabled={isPending}
              onClick={() => handleStatusUpdate('PICKED_UP')}
            >
              {t('driver.pickedUp')}
            </Button>
          )}
          {canDeliver && (
            <Button
              size="xl"
              className="h-16 w-full rounded-2xl bg-emerald-600 text-lg hover:bg-emerald-700"
              disabled={isPending}
              onClick={() => handleStatusUpdate('DELIVERED')}
            >
              {t('driver.confirmDelivery')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
