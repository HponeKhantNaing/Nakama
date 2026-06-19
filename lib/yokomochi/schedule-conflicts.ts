export const SHIFT_DURATION_HOURS = 2;

/** Driver tasks that still block a timeline slot. */
export const BLOCKING_DRIVER_TASK_STATUSES = new Set([
  'ASSIGNED',
  'ARRIVED_FACTORY',
  'LOADED_CARGO',
  'IN_TRANSIT',
]);

export type ScheduleEntry = {
  driverId: string;
  truckId: string;
  startTime: string | Date;
  endTime: string | Date;
  driverTaskStatus?: string | null;
};

function hourFrom(value: string | Date): number {
  return new Date(value).getHours();
}

function isBlocking(entry: ScheduleEntry): boolean {
  if (entry.driverTaskStatus == null) return true;
  return BLOCKING_DRIVER_TASK_STATUSES.has(entry.driverTaskStatus);
}

export function hoursOverlap(
  startHour: number,
  durationHours: number,
  blockStartHour: number,
  blockEndHour: number
): boolean {
  const endHour = startHour + durationHours;
  return startHour < blockEndHour && endHour > blockStartHour;
}

export function getBlockedStartHours(
  driverId: string | null,
  truckId: string | null,
  schedules: ScheduleEntry[],
  candidateHours: number[],
  durationHours = SHIFT_DURATION_HOURS
): number[] {
  return candidateHours.filter((hour) => {
    if (driverId) {
      const driverBusy = schedules.some(
        (s) =>
          s.driverId === driverId &&
          isBlocking(s) &&
          hoursOverlap(hour, durationHours, hourFrom(s.startTime), hourFrom(s.endTime))
      );
      if (driverBusy) return true;
    }
    if (truckId) {
      const truckBusy = schedules.some(
        (s) =>
          s.truckId === truckId &&
          isBlocking(s) &&
          hoursOverlap(hour, durationHours, hourFrom(s.startTime), hourFrom(s.endTime))
      );
      if (truckBusy) return true;
    }
    return false;
  });
}

export function getAvailableDriversAtHour(
  drivers: { id: string; name: string }[],
  hour: number,
  schedules: ScheduleEntry[],
  candidateHours: number[],
  durationHours = SHIFT_DURATION_HOURS
): { id: string; name: string }[] {
  return drivers.filter(
    (d) => !getBlockedStartHours(d.id, null, schedules, [hour], durationHours).includes(hour)
  );
}

export function getAvailableTrucksAtHour<T extends { id: string }>(
  trucks: T[],
  driverId: string,
  hour: number,
  schedules: ScheduleEntry[],
  durationHours = SHIFT_DURATION_HOURS
): T[] {
  const driverBlocked = getBlockedStartHours(driverId, null, schedules, [hour], durationHours).includes(hour);
  if (driverBlocked) return [];

  return trucks.filter(
    (t) => !getBlockedStartHours(null, t.id, schedules, [hour], durationHours).includes(hour)
  );
}

/** Hours where the driver can start and at least one truck (or the selected truck) is free. */
export function getAvailableStartHoursForAssignment(
  driverId: string | null,
  truckId: string | null,
  trucks: { id: string }[],
  schedules: ScheduleEntry[],
  candidateHours: number[],
  durationHours = SHIFT_DURATION_HOURS
): number[] {
  return candidateHours.filter((hour) => {
    if (!driverId) {
      return trucks.some(
        (t) => !getBlockedStartHours(null, t.id, schedules, [hour], durationHours).includes(hour)
      );
    }

    if (getBlockedStartHours(driverId, null, schedules, [hour], durationHours).includes(hour)) {
      return false;
    }

    if (truckId) {
      return !getBlockedStartHours(null, truckId, schedules, [hour], durationHours).includes(hour);
    }

    return trucks.some(
      (t) => !getBlockedStartHours(null, t.id, schedules, [hour], durationHours).includes(hour)
    );
  });
}

export function getDriversWithAvailability(
  drivers: { id: string; name: string }[],
  trucks: { id: string }[],
  schedules: ScheduleEntry[],
  candidateHours: number[],
  durationHours = SHIFT_DURATION_HOURS
): { id: string; name: string }[] {
  return drivers.filter(
    (d) =>
      getAvailableStartHoursForAssignment(d.id, null, trucks, schedules, candidateHours, durationHours)
        .length > 0
  );
}

export function describeHourBlockReason(
  driverId: string,
  truckId: string | null,
  hour: number,
  schedules: ScheduleEntry[],
  drivers: { id: string; name: string }[],
  trucks: { id: string; truckNo?: string | null; truckNumber?: string }[],
  durationHours = SHIFT_DURATION_HOURS
): string | null {
  const driverBlocked = getBlockedStartHours(driverId, null, schedules, [hour], durationHours).includes(hour);
  if (driverBlocked) {
    const conflict = schedules.find(
      (s) =>
        s.driverId === driverId &&
        isBlocking(s) &&
        hoursOverlap(hour, durationHours, hourFrom(s.startTime), hourFrom(s.endTime))
    );
    const name = drivers.find((d) => d.id === driverId)?.name ?? 'Driver';
    return `${name} is already scheduled ${hour}:00–${hour + durationHours}:00`;
  }

  if (truckId) {
    const truckBlocked = getBlockedStartHours(null, truckId, schedules, [hour], durationHours).includes(hour);
    if (truckBlocked) {
      const conflict = schedules.find(
        (s) =>
          s.truckId === truckId &&
          isBlocking(s) &&
          hoursOverlap(hour, durationHours, hourFrom(s.startTime), hourFrom(s.endTime))
      );
      const truckLabel =
        trucks.find((t) => t.id === truckId)?.truckNo ??
        trucks.find((t) => t.id === truckId)?.truckNumber ??
        'Truck';
      const otherDriver = conflict
        ? drivers.find((d) => d.id === conflict.driverId)?.name
        : null;
      return otherDriver
        ? `${truckLabel} is in use ${hour}:00–${hour + durationHours}:00 (${otherDriver}) — try the other truck`
        : `${truckLabel} is in use ${hour}:00–${hour + durationHours}:00 — try the other truck`;
    }
  }

  return null;
}

export function findScheduleConflict(
  driverId: string,
  truckId: string,
  startTime: Date,
  endTime: Date,
  schedules: ScheduleEntry[]
): string | null {
  const startHour = startTime.getHours();
  const duration = Math.max(1, endTime.getHours() - startHour);

  for (const s of schedules) {
    if (!isBlocking(s)) continue;
    const sh = hourFrom(s.startTime);
    const eh = hourFrom(s.endTime);

    if (s.driverId === driverId && hoursOverlap(startHour, duration, sh, eh)) {
      return 'Driver is already scheduled for this time slot';
    }
    if (s.truckId === truckId && hoursOverlap(startHour, duration, sh, eh)) {
      return 'Truck is already scheduled for this time slot';
    }
  }
  return null;
}
