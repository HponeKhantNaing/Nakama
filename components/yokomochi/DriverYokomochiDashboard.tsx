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
import { ArrowDown, Package, Truck } from 'lucide-react';

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
      <div className="mx-auto max-w-lg space-y-6 pb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('yokomochiDriver.title')}</h1>
          {task && (
            <p className="text-sm text-muted-foreground">
              {interpolate(t('yokomochiDriver.routeExample'), {
                origin: task.pickupLocation,
                destination: task.destination,
              })}
            </p>
          )}
        </div>

        {task ? (
          <Card className="overflow-hidden border-2 border-primary/20 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{task.trip.tripCode}</p>
                  <p className="text-lg font-semibold">{task.trip.yokomochiOrder.orderNo}</p>
                </div>
                <Badge variant="outline">{statusLabel(task.status)}</Badge>
              </div>

              <div className="rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-3 text-base font-medium">
                  <span>{task.pickupLocation}</span>
                  <ArrowDown className="h-5 w-5 shrink-0 text-primary" />
                  <span>{task.destination}</span>
                </div>
                {task.eta && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('delivery.eta')} {formatDate(task.eta)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{task.truck?.truckNo ?? task.truck?.plateNumber ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {interpolate(t('yokomochi.palletsBoxesShort'), {
                      pallets: task.pallets,
                      boxes: task.boxes,
                    })}
                  </span>
                </div>
              </div>

              {task.cargoType && (
                <p className="text-sm text-muted-foreground">
                  {interpolate(t('yokomochi.cargoLabel'), { type: task.cargoType })}
                </p>
              )}

              {action && (
                <Button
                  className="h-14 w-full text-lg font-semibold"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateDriverTaskStatus(task.id, action.next);
                      router.refresh();
                    })
                  }
                >
                  {t(action.labelKey)}
                </Button>
              )}

              {task.status === 'ARRIVED_WAREHOUSE' && (
                <>
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
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              {t('yokomochiDriver.noTask')}
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t('yokomochiDriver.history')}</h2>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{h.trip.tripCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {interpolate(t('yokomochi.palletsBoxesShort'), {
                      pallets: h.pallets,
                      boxes: h.boxes,
                    })}{' '}
                    · {h.cargoType ?? '—'}
                  </p>
                </div>
                <Badge variant="secondary">{statusLabel(h.status)}</Badge>
              </div>
            ))}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
