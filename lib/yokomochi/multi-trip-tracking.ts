export type MultiTripTrackable = {
  orderNo: string;
  tripCode: string;
  tripNo: number;
  driverId: string;
  truckId: string | null;
  taskStatus: string;
  verificationStatus: string | null;
};

export type MultiTripRowMeta = {
  totalTrips: number;
  /** 1-based leg index for the active delivery run; null when only one trip. */
  bulletNumber: number | null;
  /** Only the active leg row renders the live progress bar. */
  showProgress: boolean;
  progressStatus: string;
  progressVerificationStatus: string | null;
};

function groupKey(row: MultiTripTrackable) {
  return `${row.orderNo}|${row.driverId}|${row.truckId ?? 'none'}`;
}

function isTripComplete(taskStatus: string) {
  return taskStatus === 'COMPLETED' || taskStatus === 'CANCELLED';
}

export function buildMultiTripRowMeta<T extends MultiTripTrackable>(
  rows: T[]
): Map<string, MultiTripRowMeta> {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = groupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const meta = new Map<string, MultiTripRowMeta>();

  for (const group of Array.from(groups.values())) {
    group.sort((a: T, b: T) => a.tripNo - b.tripNo);
    const totalTrips = group.length;
    const completedCount = group.filter((t: T) => t.taskStatus === 'COMPLETED').length;
    const activeTrip =
      group.find((t: T) => !isTripComplete(t.taskStatus)) ?? group[group.length - 1];

    const bulletNumber =
      totalTrips > 1
        ? activeTrip.taskStatus === 'COMPLETED'
          ? completedCount
          : completedCount + 1
        : null;

    for (const row of group) {
      const isActiveRow = row.tripCode === activeTrip.tripCode;
      const showProgress = totalTrips === 1 || isActiveRow;

      meta.set(row.tripCode, {
        totalTrips,
        bulletNumber,
        showProgress,
        progressStatus: activeTrip.taskStatus,
        progressVerificationStatus:
          activeTrip.taskStatus === 'COMPLETED'
            ? 'APPROVED'
            : activeTrip.taskStatus === 'ARRIVED_WAREHOUSE'
              ? row.verificationStatus
              : null,
      });
    }
  }

  return meta;
}
