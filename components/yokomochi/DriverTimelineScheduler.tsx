'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { assignInternalFleetTrip } from '@/app/actions/yokomochi';
import { cn } from '@/lib/utils';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

type Driver = { id: string; name: string };
type Truck = { id: string; truckNo: string | null; truckNumber: string };
type Schedule = {
  id: string;
  driverId: string;
  startTime: string;
  endTime: string;
  label: string | null;
  isLunch: boolean;
  trip: { tripCode: string; pallets: number };
};
type Trip = { id: string; tripNo: number; tripCode: string; pallets: number; status: string };

export function DriverTimelineScheduler({
  date,
  drivers,
  trucks,
  schedules,
  unassignedTrips,
}: {
  date: string;
  drivers: Driver[];
  trucks: Truck[];
  schedules: Schedule[];
  unassignedTrips: Trip[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [startHour, setStartHour] = useState(8);

  function hourLeft(h: number) {
    const idx = HOURS.indexOf(h);
    return `${(idx / HOURS.length) * 100}%`;
  }

  function assign() {
    if (!selectedTrip || !selectedDriver || !selectedTruck) return;
    const start = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    startTransition(async () => {
      await assignInternalFleetTrip({
        tripId: selectedTrip,
        driverId: selectedDriver,
        truckId: selectedTruck,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        label: `Trip`,
      });
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
            return (
              <div
                key={driver.id}
                className="relative grid border-b last:border-b-0"
                style={{ gridTemplateColumns: `100px repeat(${HOURS.length}, 1fr)` }}
              >
                <div className="flex items-center p-2 text-sm font-medium">{driver.name}</div>
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
                      {s.label ?? s.trip.tripCode} ({s.trip.pallets}p)
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
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2 text-sm" value={selectedTrip} onChange={(e) => setSelectedTrip(e.target.value)}>
              <option value="">Trip</option>
              {unassignedTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripCode} ({t.pallets}p)
                </option>
              ))}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}>
              <option value="">Driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)}>
              <option value="">Truck</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNo ?? t.truckNumber}
                </option>
              ))}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  Start {h}:00
                </option>
              ))}
            </select>
          </div>
          <Button className="mt-3 rounded-xl" disabled={isPending} onClick={assign}>
            Assign to Schedule
          </Button>
        </div>
      )}
    </div>
  );
}
