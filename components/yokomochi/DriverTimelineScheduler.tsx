'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { assignInternalFleetTrip } from '@/app/actions/yokomochi';
import {
  describeHourBlockReason,
  getAvailableStartHoursForAssignment,
  getAvailableTrucksAtHour,
  getDriversWithAvailability,
  SHIFT_DURATION_HOURS,
  type ScheduleEntry,
} from '@/lib/yokomochi/schedule-conflicts';
import { cn } from '@/lib/utils';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

type Driver = { id: string; name: string };
type Truck = { id: string; truckNo: string | null; truckNumber: string };
type Schedule = {
  id: string;
  driverId: string;
  truckId: string;
  startTime: string;
  endTime: string;
  label: string | null;
  isLunch: boolean;
  driverTaskStatus?: string | null;
  trip: { tripCode: string; pallets: number; yokomochiOrder?: { orderNo: string } | null };
};
type Trip = { id: string; tripNo: number; tripCode: string; pallets: number; status: string };

export function DriverTimelineScheduler({
  date,
  drivers,
  trucks,
  schedules,
  unassignedTrips,
  onAssigned,
}: {
  date: string;
  drivers: Driver[];
  trucks: Truck[];
  schedules: Schedule[];
  unassignedTrips: Trip[];
  onAssigned?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [startHour, setStartHour] = useState(8);
  const [error, setError] = useState('');

  const scheduleEntries: ScheduleEntry[] = useMemo(
    () =>
      schedules.map((s) => ({
        driverId: s.driverId,
        truckId: s.truckId,
        startTime: s.startTime,
        endTime: s.endTime,
        driverTaskStatus: s.driverTaskStatus ?? null,
      })),
    [schedules]
  );

  const driversWithSlots = useMemo(
    () => getDriversWithAvailability(drivers, trucks, scheduleEntries, HOURS),
    [drivers, trucks, scheduleEntries]
  );

  const availableStartHours = useMemo(
    () =>
      getAvailableStartHoursForAssignment(
        selectedDriver || null,
        selectedTruck || null,
        trucks,
        scheduleEntries,
        HOURS
      ),
    [selectedDriver, selectedTruck, trucks, scheduleEntries]
  );

  const availableTrucks = useMemo(() => {
    if (!selectedDriver) return trucks;
    return getAvailableTrucksAtHour(trucks, selectedDriver, startHour, scheduleEntries);
  }, [trucks, selectedDriver, startHour, scheduleEntries]);

  const blockHint = useMemo(() => {
    if (!selectedDriver) return null;
    if (availableStartHours.includes(startHour)) return null;
    return describeHourBlockReason(
      selectedDriver,
      selectedTruck || null,
      startHour,
      scheduleEntries,
      drivers,
      trucks
    );
  }, [selectedDriver, selectedTruck, startHour, scheduleEntries, drivers, trucks, availableStartHours]);

  useEffect(() => {
    if (availableStartHours.length > 0 && !availableStartHours.includes(startHour)) {
      setStartHour(availableStartHours[0]);
    }
  }, [availableStartHours, startHour]);

  useEffect(() => {
    if (!selectedDriver) return;
    const hours = getAvailableStartHoursForAssignment(
      selectedDriver,
      null,
      trucks,
      scheduleEntries,
      HOURS
    );
    if (hours.length > 0 && !hours.includes(startHour)) {
      setStartHour(hours[0]);
    }
  }, [selectedDriver, trucks, scheduleEntries, startHour]);

  useEffect(() => {
    if (!selectedDriver) return;
    const trucksAtHour = getAvailableTrucksAtHour(trucks, selectedDriver, startHour, scheduleEntries);
    if (trucksAtHour.length === 0) return;
    if (!selectedTruck || !trucksAtHour.some((t) => t.id === selectedTruck)) {
      setSelectedTruck(trucksAtHour[0].id);
    }
  }, [selectedDriver, selectedTruck, startHour, trucks, scheduleEntries]);

  function hourLeft(h: number) {
    const idx = HOURS.indexOf(h);
    return `${(idx / HOURS.length) * 100}%`;
  }

  function assign() {
    if (!selectedTrip || !selectedDriver || !selectedTruck) return;
    setError('');
    const start = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
    const end = new Date(start);
    end.setHours(end.getHours() + SHIFT_DURATION_HOURS);
    startTransition(async () => {
      const result = await assignInternalFleetTrip({
        tripId: selectedTrip,
        driverId: selectedDriver,
        truckId: selectedTruck,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        label: `Trip`,
      });
      if (result && 'success' in result && !result.success) {
        setError(result.error ?? 'Failed to assign');
        return;
      }
      onAssigned?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-white">
        <div className="min-w-[720px]">
          <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `100px repeat(${HOURS.length}, 1fr)` }}>
            <div className="p-2 text-xs font-medium text-muted-foreground">Driver</div>
            {HOURS.map((h) => (
              <div key={h} className="border-l p-2 text-center text-xs text-muted-foreground">
                {h}
              </div>
            ))}
          </div>

          {drivers.map((driver) => {
            const driverSchedules = schedules.filter((s) => s.driverId === driver.id);
            const assignedOrderCodes = Array.from(
              new Set(
                driverSchedules
                  .map((s) => s.trip.yokomochiOrder?.orderNo)
                  .filter((orderNo): orderNo is string => Boolean(orderNo))
              )
            );
            return (
              <div
                key={driver.id}
                className="relative grid border-b last:border-b-0"
                style={{ gridTemplateColumns: `100px repeat(${HOURS.length}, 1fr)` }}
              >
                <div className="flex min-h-[48px] flex-col justify-center p-2">
                  <span className="text-sm font-medium">{driver.name}</span>
                  {assignedOrderCodes.length > 0 && (
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {assignedOrderCodes.join(', ')}
                    </span>
                  )}
                </div>
                {HOURS.map((h) => (
                  <div key={h} className="relative min-h-[48px] border-l" />
                ))}
                {driverSchedules.map((s) => {
                  const sh = new Date(s.startTime).getHours();
                  const eh = new Date(s.endTime).getHours();
                  const span = Math.max(1, eh - sh);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'absolute top-2 z-10 mx-0.5 rounded-md px-2 py-1 text-[10px] font-medium text-white',
                        s.isLunch ? 'bg-gray-400' : 'bg-primary'
                      )}
                      style={{
                        left: `calc(100px + ${hourLeft(sh)})`,
                        width: `calc((100% - 100px) * ${span / HOURS.length})`,
                      }}
                      title={s.trip.tripCode}
                    >
                      {s.trip.yokomochiOrder?.orderNo ?? s.trip.tripCode} · {s.trip.tripCode} ({s.trip.pallets}p)
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {unassignedTrips.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-semibold">Assign Trip to Timeline</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Pick driver first — an available truck is suggested automatically. Each trip uses one truck for{' '}
            {SHIFT_DURATION_HOURS} hours.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
            >
              <option value="">Trip</option>
              {unassignedTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripCode} ({t.pallets}p)
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={selectedDriver}
              onChange={(e) => {
                setSelectedDriver(e.target.value);
                setSelectedTruck('');
              }}
            >
              <option value="">Driver</option>
              {driversWithSlots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={selectedTruck}
              disabled={!selectedDriver}
              onChange={(e) => setSelectedTruck(e.target.value)}
            >
              <option value="">Truck</option>
              {availableTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNo ?? t.truckNumber}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={startHour}
              disabled={!selectedDriver}
              onChange={(e) => setStartHour(Number(e.target.value))}
            >
              {availableStartHours.length === 0 ? (
                <option value="">No free slots</option>
              ) : (
                availableStartHours.map((h) => (
                  <option key={h} value={h}>
                    Start {h}:00
                  </option>
                ))
              )}
            </select>
          </div>
          {blockHint && (
            <p className="mt-2 text-xs text-amber-700">{blockHint}</p>
          )}
          {selectedDriver && availableTrucks.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {availableTrucks.length} trucks free at {startHour}:00 for{' '}
              {drivers.find((d) => d.id === selectedDriver)?.name}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button
            className="mt-3 rounded-xl"
            disabled={isPending || !selectedTrip || !selectedDriver || !selectedTruck || availableStartHours.length === 0}
            onClick={assign}
          >
            Assign to Schedule
          </Button>
        </div>
      )}
    </div>
  );
}
