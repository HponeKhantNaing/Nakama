'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, statusColor } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { MapPin, Package, Phone, User } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';

export function ActiveDeliveryCard({
  requestNo,
  status,
  pickup,
  destination,
  expectedPickupDate,
  customerName,
  customerAddress,
  customerPhone,
  cargoType,
  boxes,
  weightKg,
  truckLabel,
}: {
  requestNo: string;
  status: string;
  pickup: string;
  destination: string;
  expectedPickupDate: Date;
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  cargoType: string | null;
  boxes: number;
  weightKg: number;
  truckLabel: string;
}) {
  const { t, formatDate, statusLabel } = useTranslation();

  return (
    <Card className="rounded-3xl border-primary/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{requestNo}</p>
            <p className="mt-1 text-lg font-bold">{t('driver.activeDelivery')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {interpolate(t('delivery.pickupTime'), { time: formatDate(expectedPickupDate) })}
            </p>
          </div>
          <Badge className={cn('rounded-xl font-normal', statusColor(status))}>
            {statusLabel(status)}
          </Badge>
        </div>

        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">{t('delivery.pickupWarehouse')}</p>
              <p className="font-semibold">{pickup}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 text-blue-700" />
            <div>
              <p className="text-xs font-semibold text-blue-700">{t('driver.destination')}</p>
              <p className="font-semibold">{destination}</p>
              <p className="mt-1 text-xs text-muted-foreground">{customerAddress}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('driver.customerLabel')}</p>
              </div>
              <p className="mt-1 font-semibold">{customerName}</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <AppLogo size="sm" />
                <p className="text-xs text-muted-foreground">{t('driver.truckLabel')}</p>
              </div>
              <p className="mt-1 font-semibold">{truckLabel}</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('driver.phoneLabel')}</p>
              </div>
              <p className="mt-1 font-semibold">{customerPhone ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">{t('driver.cargo')}</p>
              <p className="font-semibold">
                {cargoType ?? t('delivery.productsFallback')} —{' '}
                {interpolate(t('delivery.boxesWeight'), { boxes, weight: weightKg })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
