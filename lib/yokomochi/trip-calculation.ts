import { PALLETS_PER_TEN_TON_TRIP } from './constants';

export type TripCalculationResult = {
  totalPallets: number;
  totalTrips: number;
  remainderPallets: number;
  palletsPerTrip: number;
};

export function calculateTripsFromPallets(
  totalPallets: number,
  palletsPerTrip = PALLETS_PER_TEN_TON_TRIP
): TripCalculationResult {
  const pallets = Math.max(0, totalPallets);
  if (pallets === 0) {
    return { totalPallets: 0, totalTrips: 0, remainderPallets: 0, palletsPerTrip };
  }
  const totalTrips = Math.ceil(pallets / palletsPerTrip);
  const remainderPallets = pallets % palletsPerTrip;
  return {
    totalPallets: pallets,
    totalTrips,
    remainderPallets: remainderPallets === 0 ? 0 : remainderPallets,
    palletsPerTrip,
  };
}

export function palletsForTrip(tripNo: number, totalPallets: number, palletsPerTrip = PALLETS_PER_TEN_TON_TRIP) {
  const remaining = totalPallets - (tripNo - 1) * palletsPerTrip;
  return Math.min(palletsPerTrip, Math.max(0, remaining));
}

export function generateOrderNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `YM-${y}${m}${day}-${rand}`;
}

export function generateDeliveryNo() {
  return `DC-${Date.now().toString(36).toUpperCase()}`;
}
