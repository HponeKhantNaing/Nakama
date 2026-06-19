import { TruckType } from '@prisma/client';
import {
  FOUR_TON_BOXES,
  FOUR_TON_PALLETS,
  TEN_TON_BOXES,
  TEN_TON_PALLETS,
} from '@/lib/yokomochi/pallet-capacity';

export type YokomochiVehicleCapacity = {
  boxes: number;
  pallets: number;
  label: string;
};

/** Yokomochi carrier allocation rules (boxes per single trip). */
export const YOKOMOCHI_VEHICLE_CAPACITY: Record<TruckType, YokomochiVehicleCapacity> = {
  TEN_TON: { boxes: TEN_TON_BOXES, pallets: TEN_TON_PALLETS, label: '10-ton Large Truck (10t)' },
  MEDIUM: { boxes: FOUR_TON_BOXES, pallets: FOUR_TON_PALLETS, label: '4-ton Medium Truck (4t)' },
  SMALL: { boxes: 5, pallets: 1, label: 'Van (Small)' },
  BANN: { boxes: 5, pallets: 1, label: 'Van (Small)' },
};

export function getYokomochiBoxCapacity(truckType: TruckType): number {
  return YOKOMOCHI_VEHICLE_CAPACITY[truckType]?.boxes ?? 5;
}

export function getYokomochiPalletCapacity(truckType: TruckType): number {
  return YOKOMOCHI_VEHICLE_CAPACITY[truckType]?.pallets ?? 1;
}

export function getYokomochiVehicleLabel(truckType: TruckType): string {
  return YOKOMOCHI_VEHICLE_CAPACITY[truckType]?.label ?? truckType;
}

export function calcAllocatedBoxes(truckType: TruckType, deliveryTimes: number): number {
  return getYokomochiBoxCapacity(truckType) * Math.max(1, deliveryTimes);
}
