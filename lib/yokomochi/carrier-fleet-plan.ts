/** Split trips across fleet as evenly as possible (first drivers get +1 when remainder). */
export function splitTripsAcrossFleet(tripCount: number, fleetCount: number): number[] {
  if (fleetCount <= 0 || tripCount <= 0) return [];
  const base = Math.floor(tripCount / fleetCount);
  const extra = tripCount % fleetCount;
  return Array.from({ length: fleetCount }, (_, i) => base + (i < extra ? 1 : 0));
}

export function formatFleetTripPlan(tripCount: number, fleetCount: number): string {
  if (fleetCount <= 0 || tripCount <= 0) return '';
  const splits = splitTripsAcrossFleet(tripCount, fleetCount);
  if (splits.every((n) => n === splits[0])) {
    return `${fleetCount} drivers × ${splits[0]} trip${splits[0] !== 1 ? 's' : ''} each (${tripCount} total)`;
  }
  return `${fleetCount} drivers: ${splits.join(' + ')} trips (${tripCount} total) — exact split decided at driver assignment`;
}
