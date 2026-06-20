'use client';



import { useEffect, useState } from 'react';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { getDriverSchedule } from '@/app/actions/yokomochi';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';

import { warehouseNavItems } from '@/lib/nav/yokomochi';

import { DriverTimelineScheduler } from '@/components/yokomochi/DriverTimelineScheduler';

import { DailyDriverResourceCalendar } from '@/components/yokomochi/DailyDriverResourceCalendar';
import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';
import { useTranslation } from '@/lib/i18n/context';

import { ArrowRight } from 'lucide-react';

import { sameCalendarDate } from '@/lib/yokomochi/dates';



export function WarehouseInternalFleetClient({

  initialDate,

  drivers: initialDrivers,

  trucks,

  schedules: initialSchedules,

  unassignedTrips,

}: {

  initialDate: string;

  drivers: any[];

  trucks: any[];

  schedules: any[];

  unassignedTrips: any[];

}) {

  const router = useRouter();

  const { t } = useTranslation();

  const [date, setDate] = useState(initialDate);

  const [drivers, setDrivers] = useState(initialDrivers);

  const [schedules, setSchedules] = useState(initialSchedules);

  const [loadingSchedule, setLoadingSchedule] = useState(false);



  useEffect(() => {

    let cancelled = false;

    setLoadingSchedule(true);

    getDriverSchedule(date)

      .then((data) => {

        if (!cancelled) {

          setDrivers(data.drivers);

          setSchedules(data.schedules);

        }

      })

      .finally(() => {

        if (!cancelled) setLoadingSchedule(false);

      });

    return () => {

      cancelled = true;

    };

  }, [date]);



  useEffect(() => {

    setDate(initialDate);

    setSchedules(initialSchedules);

    setDrivers(initialDrivers);

  }, [initialDate, initialSchedules, initialDrivers]);



  const dayTrips = unassignedTrips.filter((t) => {

    if (!t.scheduledDate) return true;

    return sameCalendarDate(t.scheduledDate, date);

  });



  return (

    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>

      <div className="space-y-6">

        <PageHeader titleKey="nav.internalFleet" />

        <p className="text-sm text-muted-foreground">

          10t truck = 16 pallets/trip (256 boxes). Assign 小野 · 浅川 by delivery date.

        </p>



        <div className="flex flex-wrap items-end justify-between gap-3">

          <div className="space-y-1">

            <Label htmlFor="schedule-date">{t('warehouse.scheduleDate')}</Label>

            <Input

              id="schedule-date"

              type="date"

              value={date}

              onChange={(e) => setDate(e.target.value)}

              className="w-44"

            />

          </div>

          <Link
            href="/warehouse/external-carrier"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Send remaining to 建会社
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>

        </div>



        {loadingSchedule && (

          <p className="text-xs text-muted-foreground">Loading schedule for {date}…</p>

        )}



        <DailyDriverResourceCalendar date={date} drivers={drivers} schedules={schedules} />



        <DriverTimelineScheduler

          date={date}

          drivers={drivers}

          trucks={trucks}

          schedules={schedules}

          unassignedTrips={dayTrips}

          onAssigned={() => router.refresh()}

        />



        {dayTrips.length === 0 && schedules.length === 0 && !loadingSchedule && (

          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">

            <p className="font-medium text-foreground">No trips for {date}</p>

            <p className="mt-2 text-xs">Approve factory negotiation to create delivery schedules, then pick the delivery date above.</p>

            <Link
              href="/warehouse/negotiations"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Negotiations へ
            </Link>

          </div>

        )}

      </div>

    </DashboardShell>

  );

}


