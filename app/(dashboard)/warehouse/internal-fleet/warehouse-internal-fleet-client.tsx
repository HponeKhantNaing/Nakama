'use client';

import Link from 'next/link';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import { DriverTimelineScheduler } from '@/components/yokomochi/DriverTimelineScheduler';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function WarehouseInternalFleetClient({
  date,
  drivers,
  trucks,
  schedules,
  unassignedTrips,
}: {
  date: string;
  drivers: any[];
  trucks: any[];
  schedules: any[];
  unassignedTrips: any[];
}) {
  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.internalFleet" />
        <p className="text-sm text-muted-foreground">
          10t truck = 16 pallets/trip. Assign internal drivers 小野 · 浅川 on the timeline.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href="/warehouse/external-carrier">
              Send remaining to 建会社
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <DriverTimelineScheduler
          date={date}
          drivers={drivers}
          trucks={trucks}
          schedules={schedules}
          unassignedTrips={unassignedTrips}
        />
        {unassignedTrips.length === 0 && (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">割り当て可能な便がありません</p>
            <p className="mt-2 text-xs">
              工場承認後、「Factory Requests」で「配車便数を計算」を実行してください。
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/warehouse/factory-requests">Factory Requests へ戻る</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
