import type { TruckType } from '@prisma/client';
import { getYokomochiPalletCapacity } from '@/lib/yokomochi/vehicle-capacity';

import {
  BOXES_PER_PALLET,
  TEN_TON_BOXES,
  TEN_TON_PALLETS,
} from '@/lib/yokomochi/pallet-capacity';

export const INTERNAL_FLEET_BOXES_PER_PALLET = BOXES_PER_PALLET;

export type TruckCapacityLike = {
  truckType: TruckType;
  maxPallet?: number | null;
};

export type TripInventoryLike = {
  pallets: number;
  boxes?: number | null;
};

export type AssignmentSlotLike = {
  truckId: string;
  deliveryTimes: number;
};

export function getTruckPalletLimit(truck: TruckCapacityLike): number {
  if (truck.maxPallet && truck.maxPallet > 0) return truck.maxPallet;
  return getYokomochiPalletCapacity(truck.truckType);
}

export function calcSlotPalletDeduction(truck: TruckCapacityLike, deliveryTimes: number): number {
  return getTruckPalletLimit(truck) * Math.max(1, deliveryTimes);
}

export function calcSlotBoxDeduction(truck: TruckCapacityLike, deliveryTimes: number): number {
  return calcSlotPalletDeduction(truck, deliveryTimes) * INTERNAL_FLEET_BOXES_PER_PALLET;
}

export function sumTripInventory(trips: TripInventoryLike[]) {
  const pallets = trips.reduce((sum, trip) => sum + trip.pallets, 0);
  const boxes = trips.reduce(
    (sum, trip) => sum + (trip.boxes && trip.boxes > 0 ? trip.boxes : trip.pallets * INTERNAL_FLEET_BOXES_PER_PALLET),
    0
  );
  return { pallets, boxes };
}

export function sumSlotDeductions<T extends AssignmentSlotLike>(
  slots: T[],
  truckById: Map<string, TruckCapacityLike>
) {
  return slots.reduce(
    (acc, slot) => {
      const truck = truckById.get(slot.truckId);
      if (!truck) return acc;
      const pallets = calcSlotPalletDeduction(truck, slot.deliveryTimes);
      return {
        pallets: acc.pallets + pallets,
        boxes: acc.boxes + pallets * INTERNAL_FLEET_BOXES_PER_PALLET,
      };
    },
    { pallets: 0, boxes: 0 }
  );
}

export function calcRemainingInventory(
  trips: TripInventoryLike[],
  slots: AssignmentSlotLike[],
  truckById: Map<string, TruckCapacityLike>
) {
  const baseline = sumTripInventory(trips);
  const deducted = sumSlotDeductions(slots, truckById);
  return {
    baseline,
    deducted,
    remainingPallets: baseline.pallets - deducted.pallets,
    remainingBoxes: baseline.boxes - deducted.boxes,
  };
}
