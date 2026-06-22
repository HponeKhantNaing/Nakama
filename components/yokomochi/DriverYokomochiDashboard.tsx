'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { updateDriverTaskStatus } from '@/app/actions/yokomochi';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import { YokomochiWarehouseQRCard } from '@/components/yokomochi/YokomochiWarehouseQRCard';
import { DriverYokomochiStepper } from '@/components/yokomochi/DriverYokomochiStepper';
import { MapPin, Package, Truck, ChevronRight } from 'lucide-react';

const navItems = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' as const },
  { href: '/driver/history', labelKey: 'nav.history' as const },
];

type Task = {
  id: string;
  status: string;
  pickupLocation: string;
  destination: string;
  cargoType: string | null;
  boxes: number;
  pallets: number;
  eta: Date | null;
  trip: {
    tripCode: string;
    tripNo: number;
    yokomochiOrder: { orderNo: string; productName: string | null; totalTrips: number };
  };
  truck: { truckNo: string | null; plateNumber: string } | null;
};

const ACTION_MAP: Record<
  string,
  { next: 'ARRIVED_FACTORY' | 'LOADED_CARGO' | 'IN_TRANSIT' | 'ARRIVED_WAREHOUSE'; labelKey: TranslationKey }
> = {
  ASSIGNED: { next: 'ARRIVED_FACTORY', labelKey: 'yokomochiDriver.actionArrivedFactory' },
  ARRIVED_FACTORY: { next: 'LOADED_CARGO', labelKey: 'yokomochiDriver.actionLoadedCargo' },
  LOADED_CARGO: { next: 'IN_TRANSIT', labelKey: 'yokomochiDriver.actionStartTransit' },
  IN_TRANSIT: { next: 'ARRIVED_WAREHOUSE', labelKey: 'yokomochiDriver.actionArrivedWarehouse' },
};

export function DriverYokomochiDashboard({ task, history }: { task: Task | null; history: Task[] }) {
  const router = useRouter();
  const { t, formatDate, statusLabel } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const action = task ? ACTION_MAP[task.status] : null;

  useEffect(() => {
    if (task?.status !== 'ARRIVED_WAREHOUSE') return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [task?.status, router]);

  return (
    <DashboardShell titleKey="dashboard.driver" navItems={navItems}>
      <div className="mx-auto max-w-lg space-y-5 pb-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('yokomochiDriver.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('yokomochiDriver.subtitle')}</p>
        </header>

        {task ? (
          <div className="space-y-4">
            {/* Trip header */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-soft">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{task.trip.tripCode}</p>
                    <p className="truncate text-xl font-bold">{task.trip.yokomochiOrder.orderNo}</p>
                    {task.trip.yokomochiOrder.totalTrips > 1 && (
                      <p className="mt-0.5 text-xs font-medium text-primary">
                        {t('yokomochi.warehouseQrTrip')} {task.trip.tripNo} /{' '}
                        {task.trip.yokomochiOrder.totalTrips}
                      </p>
                    )}
                  </div>
                  <Badge className="shrink-0 bg-primary/15 text-primary hover:bg-primary/15">
                    {statusLabel(task.status)}
                  </Badge>
                </div>

                {/* Route */}
                <div className="rounded-xl border border-primary/10 bg-background/80 p-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      </div>
                      <div className="my-1 w-px flex-1 bg-border" />
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-4 py-0.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('driver.pickup')}
                        </p>
                        <p className="font-medium leading-snug">{task.pickupLocation}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('driver.destination')}
                        </p>
                        <p className="font-medium leading-snug">{task.destination}</p>
                      </div>
                    </div>
                  </div>
                  {task.eta && (
                    <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                      {t('delivery.eta')} {formatDate(task.eta)}
                    </p>
                  )}
                </div>

                {/* Cargo + truck */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5 rounded-xl border bg-background/60 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{t('carrier.selectVehicle')}</p>
                      <p className="truncate text-sm font-semibold">
                        {task.truck?.truckNo ?? task.truck?.plateNumber ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border bg-background/60 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{t('carrier.cargoType')}</p>
                      <p className="truncate text-sm font-semibold">
                        {interpolate(t('yokomochi.palletsBoxesShort'), {
                          pallets: task.pallets,
                          boxes: task.boxes,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
                {task.cargoType && (
                  <p className="text-center text-xs text-muted-foreground">
                    {interpolate(t('yokomochi.cargoLabel'), { type: task.cargoType })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Progress steps */}
            <Card className="border-0 shadow-soft">
              <CardContent className="p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('delivery.progress')}
                </p>
                <DriverYokomochiStepper status={task.status} />
              </CardContent>
            </Card>

            {/* Action or QR */}
            {action && (
              <Button
                className="h-14 w-full rounded-2xl text-base font-semibold shadow-md"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateDriverTaskStatus(task.id, action.next);
                    router.refresh();
                  })
                }
              >
                {t(action.labelKey)}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}

            {task.status === 'ARRIVED_WAREHOUSE' && (
              <div className="space-y-3">
                <YokomochiWarehouseQRCard
                  taskId={task.id}
                  tripCode={task.trip.tripCode}
                  orderNo={task.trip.yokomochiOrder.orderNo}
                  totalTrips={task.trip.yokomochiOrder.totalTrips || 1}
                  tripNo={task.trip.tripNo}
                />
                <p className="text-center text-sm text-muted-foreground">
                  {t('yokomochiDriver.warehousePending')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">{t('yokomochiDriver.noTask')}</p>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('yokomochiDriver.history')}
            </h2>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.trip.tripCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {interpolate(t('yokomochi.palletsBoxesShort'), {
                        pallets: h.pallets,
                        boxes: h.boxes,
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {statusLabel(h.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
