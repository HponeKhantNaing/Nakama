'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TruckType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { assignInternalFleetTrip } from '@/app/actions/yokomochi';
import {
  calcRemainingInventory,
  getTruckPalletLimit,
  INTERNAL_FLEET_BOXES_PER_PALLET,
  sumTripInventory,
} from '@/lib/yokomochi/internal-fleet-counters';
import {
  getAvailableTrucksAtHour,
  getDriversWithAvailability,
  SHIFT_DURATION_HOURS,
  type ScheduleEntry,
} from '@/lib/yokomochi/schedule-conflicts';
import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

const DEFAULT_START_HOUR = 8;
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

type Driver = { id: string; name: string };
type Truck = {
  id: string;
  truckNo: string | null;
  truckNumber: string;
  truckType: TruckType;
  maxPallet?: number | null;
};
type Schedule = {
  id: string;
  driverId: string;
  truckId: string;
  startTime: string;
  endTime: string;
  label: string | null;
  isLunch: boolean;
  driverTaskStatus?: string | null;
  trip: { tripCode: string; pallets: number; boxes?: number; yokomochiOrder?: { orderNo: string } | null };
};
type Trip = { id: string; tripNo: number; tripCode: string; pallets: number; boxes?: number; status: string };

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
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [error, setError] = useState('');

  const truckById = useMemo(() => new Map(trucks.map((truck) => [truck.id, truck])), [trucks]);

  // Counters reflect unassigned trip inventory only — not in-progress form selections.
  const inventory = useMemo(
    () => calcRemainingInventory(unassignedTrips, [], truckById),
    [unassignedTrips, truckById]
  );

  const selectedTripEntity = useMemo(
    () => unassignedTrips.find((trip) => trip.id === selectedTrip),
    [unassignedTrips, selectedTrip]
  );

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

  const availableTrucks = useMemo(() => {
    if (!selectedDriver) return trucks;
    return getAvailableTrucksAtHour(trucks, selectedDriver, DEFAULT_START_HOUR, scheduleEntries);
  }, [trucks, selectedDriver, scheduleEntries]);

  useEffect(() => {
    if (!selectedDriver) return;
    const trucksAtHour = getAvailableTrucksAtHour(
      trucks,
      selectedDriver,
      DEFAULT_START_HOUR,
      scheduleEntries
    );
    if (trucksAtHour.length === 0) return;
    if (!selectedTruck || !trucksAtHour.some((tr) => tr.id === selectedTruck)) {
      setSelectedTruck(trucksAtHour[0].id);
    }
  }, [selectedDriver, selectedTruck, trucks, scheduleEntries]);

  function assign() {
    if (!selectedTrip || !selectedDriver || !selectedTruck) return;
    setError('');

    const truck = truckById.get(selectedTruck);
    const trip = unassignedTrips.find((t) => t.id === selectedTrip);
    if (!truck) {
      setError(t('warehouse.invalidTruck'));
      return;
    }

    const tripPallets = trip?.pallets ?? getTruckPalletLimit(truck);
    const available = sumTripInventory(unassignedTrips);

    if (available.pallets < tripPallets) {
      setError(
        `${t('warehouse.insufficientPallets')} (${available.pallets}P, need ${tripPallets}P)`
      );
      return;
    }

    const start = new Date(`${date}T${String(DEFAULT_START_HOUR).padStart(2, '0')}:00:00`);
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
        setError(result.error ?? t('warehouse.assignFailed'));
        return;
      }
      onAssigned?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('warehouse.stockRemaining')}
          </p>
          <p
            className={cn(
              'mt-1 text-3xl font-bold tabular-nums',
              inventory.remainingBoxes < 0 ? 'text-destructive' : 'text-primary'
            )}
          >
            {Math.max(0, inventory.remainingBoxes)}
          </p>
          <p className="text-xs text-muted-foreground">{t('warehouse.countedInBoxes')}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('warehouse.baseline')}: {inventory.baseline.boxes} · {t('warehouse.allocated')}:{' '}
            {inventory.deducted.boxes}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('warehouse.palletsRemaining')}
          </p>
          <p
            className={cn(
              'mt-1 text-3xl font-bold tabular-nums',
              inventory.remainingPallets < 0 ? 'text-destructive' : 'text-primary'
            )}
          >
            {Math.max(0, inventory.remainingPallets)}
          </p>
          <p className="text-xs text-muted-foreground">{t('warehouse.countedInPallets')}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {INTERNAL_FLEET_BOXES_PER_PALLET} {t('warehouse.boxesPerPallet')}
          </p>
        </div>
      </div>

      {unassignedTrips.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-semibold">{t('warehouse.assignTripToTimeline')}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {t('warehouse.assignTripHint')} {SHIFT_DURATION_HOURS}h.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
            >
              <option value="">{t('warehouse.selectTrip')}</option>
              {unassignedTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.tripCode} ({trip.pallets}p)
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
              <option value="">{t('shinwa.selectDriver')}</option>
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
              <option value="">{t('shinwa.selectVehicle')}</option>
              {availableTrucks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.truckNo ?? tr.truckNumber} ({getTruckPalletLimit(tr)}P)
                </option>
              ))}
            </select>
          </div>
          {selectedTripEntity && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('warehouse.assignTripLoad')}: {selectedTripEntity.boxes ?? selectedTripEntity.pallets * INTERNAL_FLEET_BOXES_PER_PALLET}{' '}
              {t('carrier.boxes')} / {selectedTripEntity.pallets}P
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button
            className="mt-3 rounded-xl"
            disabled={
              isPending ||
              !selectedTrip ||
              !selectedDriver ||
              !selectedTruck ||
              (selectedTripEntity != null &&
                inventory.remainingPallets < selectedTripEntity.pallets)
            }
            onClick={assign}
          >
            {t('warehouse.assignToSchedule')}
          </Button>
        </div>
      )}
    </div>
  );
}
