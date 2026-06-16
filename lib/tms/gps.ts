import { LatLng } from './routing';

export interface TrackingState {
  origin: LatLng;
  destination: LatLng;
  current: LatLng;
  route: LatLng[];
  progressPercent: number;
  remainingKm: number;
  etaMinutes: number;
  speed: number;
  heading: number;
  status: string;
}

export interface GpsPing {
  driverId: string;
  tripId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export const GPS_SAMPLE_INTERVAL_MS = 30_000;

export function isValidGpsPing(ping: GpsPing): boolean {
  return (
    ping.latitude >= -90 &&
    ping.latitude <= 90 &&
    ping.longitude >= -180 &&
    ping.longitude <= 180
  );
}

export function estimateFuelLiters(distanceKm: number, truckType?: string): number {
  const consumptionPer100Km: Record<string, number> = {
    BANN: 8,
    SMALL: 12,
    MEDIUM: 18,
    TEN_TON: 28,
  };
  const rate = truckType ? (consumptionPer100Km[truckType] ?? 20) : 20;
  return Math.round((distanceKm / 100) * rate * 10) / 10;
}
