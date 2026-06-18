type TripLike = {
  id: string;
  status: string;
  internalFleetAssignment?: unknown | null;
  subcontractAssignment?: unknown | null;
};

export function getCarrierEligibleTrips<T extends TripLike>(trips: T[]): T[] {
  return trips.filter(
    (t) =>
      t.status === 'PLANNED' &&
      !t.internalFleetAssignment &&
      !t.subcontractAssignment
  );
}

/** Split trip ids across subcontractors as evenly as possible (first subs get +1). */
export function splitAmongSubcontractors(
  tripIds: string[],
  subcontractorIds: string[]
): { subcontractorId: string; tripIds: string[] }[] {
  if (subcontractorIds.length === 0 || tripIds.length === 0) return [];

  const base = Math.floor(tripIds.length / subcontractorIds.length);
  const extra = tripIds.length % subcontractorIds.length;
  const result: { subcontractorId: string; tripIds: string[] }[] = [];
  let offset = 0;

  for (let i = 0; i < subcontractorIds.length; i++) {
    const count = base + (i < extra ? 1 : 0);
    if (count === 0) continue;
    result.push({
      subcontractorId: subcontractorIds[i],
      tripIds: tripIds.slice(offset, offset + count),
    });
    offset += count;
  }

  return result;
}
