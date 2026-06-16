import { LatLng } from './routing';

/** Demo route: Tokyo → Yokohama */
export const DEMO_ROUTE_TOKYO_YOKOHAMA: LatLng[] = [
  { lat: 35.6762, lng: 139.6503 },
  { lat: 35.658, lng: 139.7016 },
  { lat: 35.632, lng: 139.715 },
  { lat: 35.59, lng: 139.728 },
  { lat: 35.55, lng: 139.74 },
  { lat: 35.51, lng: 139.62 },
  { lat: 35.47, lng: 139.55 },
  { lat: 35.44, lng: 139.638 },
  { lat: 35.4437, lng: 139.638 },
];

export const GPS_SIMULATION_INTERVAL_MS = 3000;

export interface SimulationState {
  current: LatLng;
  progress: number;
  etaMinutes: number;
  segmentIndex: number;
  heading: number;
  speed: number;
  status: string;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function totalRouteKm(route: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineKm(route[i], route[i + 1]);
  }
  return total;
}

function bearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createGpsSimulator(
  route: LatLng[] = DEMO_ROUTE_TOKYO_YOKOHAMA,
  avgSpeedKmh = 45
) {
  const totalKm = totalRouteKm(route);
  const totalMinutes = (totalKm / avgSpeedKmh) * 60;
  let step = 0;
  const stepsPerSegment = 10;
  const totalSteps = (route.length - 1) * stepsPerSegment;

  function tick(): SimulationState {
    const progress = Math.min(100, (step / totalSteps) * 100);
    const segmentIndex = Math.min(
      route.length - 2,
      Math.floor(step / stepsPerSegment)
    );
    const segmentProgress = (step % stepsPerSegment) / stepsPerSegment;
    const from = route[segmentIndex];
    const to = route[segmentIndex + 1];

    const current: LatLng = {
      lat: lerp(from.lat, to.lat, segmentProgress),
      lng: lerp(from.lng, to.lng, segmentProgress),
    };

    const remainingKm = totalKm * (1 - progress / 100);
    const etaMinutes = (remainingKm / avgSpeedKmh) * 60;

    step = Math.min(step + 1, totalSteps);

    let status = 'IN_TRANSIT';
    if (progress >= 100) status = 'ARRIVED';
    else if (progress < 5) status = 'DISPATCHED';
    else if (progress < 15) status = 'PICKED_UP';

    return {
      current,
      progress: Math.round(progress * 10) / 10,
      etaMinutes: Math.round(etaMinutes),
      segmentIndex,
      heading: bearing(from, to),
      speed: avgSpeedKmh,
      status,
    };
  }

  function reset() {
    step = 0;
  }

  return { tick, reset, route, totalKm };
}
