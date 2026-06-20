'use client';

import { useMemo, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views, type Event } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { updateDriverScheduleTimes } from '@/app/actions/yokomochi';
import { useTranslation } from '@/lib/i18n/context';

type CalendarEvent = Event & { id: string; resourceId?: string };
const DnDCalendar = withDragAndDrop<CalendarEvent, { resourceId: string; resourceTitle: string }>(Calendar);

type Driver = { id: string; name: string };
type Schedule = {
  id: string;
  driverId: string;
  startTime: string;
  endTime: string;
  trip: {
    tripCode: string;
    pallets: number;
    yokomochiOrder?: { orderNo: string } | null;
  };
};

export function DailyDriverResourceCalendar({
  date,
  drivers,
  schedules,
}: {
  date: string;
  drivers: Driver[];
  schedules: Schedule[];
}) {
  const router = useRouter();
  const { locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const localizer = useMemo(
    () =>
      dateFnsLocalizer({
        format,
        parse,
        startOfWeek,
        getDay,
        locales: locale === 'ja' ? { ja } : { 'en-US': enUS },
      }),
    [locale]
  );

  const dayStart = useMemo(() => new Date(`${date}T08:00:00`), [date]);
  const dayEnd = useMemo(() => new Date(`${date}T18:00:00`), [date]);

  const resources = useMemo(
    () => drivers.map((d) => ({ resourceId: d.id, resourceTitle: d.name })),
    [drivers]
  );

  const events: CalendarEvent[] = useMemo(
    () =>
      schedules.map((s) => ({
        id: s.id,
        title: `${s.trip.yokomochiOrder?.orderNo ?? ''} ${s.trip.tripCode} (${s.trip.pallets}p)`,
        start: new Date(s.startTime),
        end: new Date(s.endTime),
        resourceId: s.driverId,
      })),
    [schedules]
  );

  const onEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: string | Date; end: string | Date }) => {
      if (!event.id) return;
      const startDate = start instanceof Date ? start : new Date(start);
      const endDate = end instanceof Date ? end : new Date(end);
      startTransition(async () => {
        await updateDriverScheduleTimes({
          scheduleId: String(event.id),
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        });
        router.refresh();
      });
    },
    [router]
  );

  const onEventResize = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: string | Date; end: string | Date }) => {
      if (!event.id) return;
      const startDate = start instanceof Date ? start : new Date(start);
      const endDate = end instanceof Date ? end : new Date(end);
      startTransition(async () => {
        await updateDriverScheduleTimes({
          scheduleId: String(event.id),
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        });
        router.refresh();
      });
    },
    [router]
  );

  return (
    <div className="daily-driver-calendar overflow-hidden rounded-xl border bg-white p-2">
      <style jsx global>{`
        .daily-driver-calendar .rbc-time-header-gutter,
        .daily-driver-calendar .rbc-time-gutter {
          font-size: 11px;
        }
        .daily-driver-calendar .rbc-event {
          font-size: 11px;
          padding: 2px 4px;
        }
      `}</style>
      <DnDCalendar
        localizer={localizer}
        culture={locale === 'ja' ? 'ja' : 'en-US'}
        events={events}
        defaultView={Views.DAY}
        views={[Views.DAY]}
        date={dayStart}
        min={dayStart}
        max={dayEnd}
        step={60}
        timeslots={1}
        resources={resources}
        resourceIdAccessor="resourceId"
        resourceTitleAccessor="resourceTitle"
        resizable={!isPending}
        draggableAccessor={() => !isPending}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        style={{ height: 520 }}
        toolbar={false}
      />
    </div>
  );
}
