'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { updateDriverTaskStatus } from '@/app/actions/yokomochi';
import { formatDate } from '@/lib/utils';
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
    yokomochiOrder: { orderNo: string; productName: string | null };
  };
  truck: { truckNo: string | null; plateNumber: string } | null;
};

const ACTION_MAP: Record<string, { next: 'ARRIVED_FACTORY' | 'LOADED_CARGO' | 'IN_TRANSIT' | 'ARRIVED_WAREHOUSE'; label: string }> = {
  ASSIGNED: { next: 'ARRIVED_FACTORY', label: '工場到着' },
  ARRIVED_FACTORY: { next: 'LOADED_CARGO', label: '積込完了' },
  LOADED_CARGO: { next: 'IN_TRANSIT', label: '配送開始' },
  IN_TRANSIT: { next: 'ARRIVED_WAREHOUSE', label: '倉庫到着' },
};

export function DriverYokomochiDashboard({ task, history }: { task: Task | null; history: Task[] }) {
  const router = useRouter();
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
          <h1 className="text-xl font-semibold tracking-tight">横持配送</h1>
          <p className="text-sm text-muted-foreground">キーコーヒー → 20号物流センター</p>
        </div>

        {task ? (
          <Card className="overflow-hidden border-2 border-primary/20 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{task.trip.tripCode}</p>
                  <p className="text-lg font-semibold">{task.trip.yokomochiOrder.orderNo}</p>
                </div>
                <Badge variant="outline">{task.status.replace(/_/g, ' ')}</Badge>
              </div>

              <div className="rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-3 text-base font-medium">
                  <span>{task.pickupLocation}</span>
                  <ArrowDown className="h-5 w-5 shrink-0 text-primary" />
                  <span>{task.destination}</span>
                </div>
                {task.eta && (
                  <p className="mt-2 text-sm text-muted-foreground">ETA {formatDate(task.eta)}</p>
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
                    {task.pallets}P · {task.boxes}箱
                  </span>
                </div>
              </div>

              {task.cargoType && (
                <p className="text-sm text-muted-foreground">荷種: {task.cargoType}</p>
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
                  {action.label}
                </Button>
              )}

              {task.status === 'ARRIVED_WAREHOUSE' && (
                <>
                  <YokomochiWarehouseQRCard
                    tripCode={task.trip.tripCode}
                    orderNo={task.trip.yokomochiOrder.orderNo}
                  />
                  <p className="text-center text-sm text-muted-foreground">
                    倉庫確認待ち — 倉庫が下記トリップコードをスキャンすると完了します
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              現在の配送タスクはありません
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">配送履歴</h2>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{h.trip.tripCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.pallets}P · {h.cargoType ?? '—'}
                  </p>
                </div>
                <Badge variant="secondary">{h.status}</Badge>
              </div>
            ))}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
