import { TruckType } from '@prisma/client';

export interface TruckSpec {
  type: TruckType;
  capacityWeightKg: number;
  capacityVolumeM3: number;
  maxBoxes: number;
  label: string;
}

export const TRUCK_SPECS: TruckSpec[] = [
  { type: TruckType.MEDIUM, capacityWeightKg: 4000, capacityVolumeM3: 16, maxBoxes: 80, label: '4T Truck (5 pallets)' },
  { type: TruckType.TEN_TON, capacityWeightKg: 10000, capacityVolumeM3: 40, maxBoxes: 256, label: '10T Truck (16 pallets)' },
];

export function getTruckSpec(type: TruckType): TruckSpec {
  const spec = TRUCK_SPECS.find((s) => s.type === type);
  if (!spec) throw new Error(`Unknown truck type: ${type}`);
  return spec;
}

export interface TruckTypeAssignment {
  truckType: TruckType;
  count: number;
  capacityWeightKg: number;
  capacityVolumeM3: number;
  maxBoxes: number;
  utilizationPercent: number;
}

export interface AssignmentPlan {
  totalWeightKg: number;
  totalVolumeM3: number;
  totalQuantity: number;
  assignments: TruckTypeAssignment[];
  requiresSplit: boolean;
  splitReason?: string;
  insufficientCapacity?: boolean;
}

const ASSIGNABLE_TYPES: TruckType[] = [
  TruckType.MEDIUM,
  TruckType.TEN_TON,
];

/**
 * Greedy bin-packing by truck type specs (weight, volume, box count).
 */
export function suggestTruckAssignment(
  totalWeightKg: number,
  totalVolumeM3: number,
  totalQuantity = 0
): AssignmentPlan {
  const specs = ASSIGNABLE_TYPES.map(getTruckSpec).sort(
    (a, b) => a.capacityWeightKg - b.capacityWeightKg
  );

  for (const spec of specs) {
    if (
      totalWeightKg <= spec.capacityWeightKg &&
      totalVolumeM3 <= spec.capacityVolumeM3 &&
      (totalQuantity === 0 || totalQuantity <= spec.maxBoxes)
    ) {
      const weightUtil = (totalWeightKg / spec.capacityWeightKg) * 100;
      const volumeUtil = (totalVolumeM3 / spec.capacityVolumeM3) * 100;
      const boxUtil = totalQuantity > 0 ? (totalQuantity / spec.maxBoxes) * 100 : 0;
      return {
        totalWeightKg,
        totalVolumeM3,
        totalQuantity,
        assignments: [
          {
            truckType: spec.type,
            count: 1,
            capacityWeightKg: spec.capacityWeightKg,
            capacityVolumeM3: spec.capacityVolumeM3,
            maxBoxes: spec.maxBoxes,
            utilizationPercent: Math.max(weightUtil, volumeUtil, boxUtil),
          },
        ],
        requiresSplit: false,
      };
    }
  }

  const assignments: TruckTypeAssignment[] = [];
  let remainingWeight = totalWeightKg;
  let remainingVolume = totalVolumeM3;
  let remainingQty = totalQuantity;
  const sortedDesc = [...specs].sort((a, b) => b.capacityWeightKg - a.capacityWeightKg);

  while (remainingWeight > 0 || remainingVolume > 0 || remainingQty > 0) {
    let placed = false;
    for (const spec of sortedDesc) {
      const fitsWeight = remainingWeight <= spec.capacityWeightKg;
      const fitsVolume = remainingVolume <= spec.capacityVolumeM3;
      const fitsBoxes = remainingQty === 0 || remainingQty <= spec.maxBoxes;
      if (fitsWeight && fitsVolume && fitsBoxes) {
        pushAssignment(assignments, spec, remainingWeight, remainingVolume, remainingQty);
        remainingWeight = 0;
        remainingVolume = 0;
        remainingQty = 0;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const largest = sortedDesc[0];
      const loadWeight = Math.min(remainingWeight, largest.capacityWeightKg);
      const loadVolume = Math.min(remainingVolume, largest.capacityVolumeM3);
      const loadQty =
        remainingQty > 0 ? Math.min(remainingQty, largest.maxBoxes) : 0;
      pushAssignment(assignments, largest, loadWeight, loadVolume, loadQty);
      remainingWeight = Math.max(0, remainingWeight - largest.capacityWeightKg);
      remainingVolume = Math.max(0, remainingVolume - largest.capacityVolumeM3);
      remainingQty = Math.max(0, remainingQty - largest.maxBoxes);
    }
  }

  const truckCount = assignments.reduce((s, a) => s + a.count, 0);
  return {
    totalWeightKg,
    totalVolumeM3,
    totalQuantity,
    assignments,
    requiresSplit: truckCount > 1,
    splitReason:
      truckCount > 1 ? 'Cargo exceeds single truck capacity — multiple trucks required' : undefined,
  };
}

function pushAssignment(
  assignments: TruckTypeAssignment[],
  spec: TruckSpec,
  weight: number,
  volume: number,
  qty: number
) {
  const weightUtil = (weight / spec.capacityWeightKg) * 100;
  const volumeUtil = (volume / spec.capacityVolumeM3) * 100;
  const boxUtil = qty > 0 ? (qty / spec.maxBoxes) * 100 : 0;
  const existing = assignments.find((a) => a.truckType === spec.type);
  if (existing) {
    existing.count += 1;
  } else {
    assignments.push({
      truckType: spec.type,
      count: 1,
      capacityWeightKg: spec.capacityWeightKg,
      capacityVolumeM3: spec.capacityVolumeM3,
      maxBoxes: spec.maxBoxes,
      utilizationPercent: Math.max(weightUtil, volumeUtil, boxUtil),
    });
  }
}

export interface SplitPlan {
  internalWeightKg: number;
  internalVolumeM3: number;
  subcontractWeightKg: number;
  subcontractVolumeM3: number;
  internalTrucks: TruckTypeAssignment[];
  subcontractTrucks: TruckTypeAssignment[];
}

export function planDeliverySplit(
  totalWeightKg: number,
  totalVolumeM3: number,
  carrierCapacityKg: number,
  totalQuantity = 0
): SplitPlan {
  const internalWeightKg = Math.min(totalWeightKg, carrierCapacityKg);
  const subcontractWeightKg = Math.max(0, totalWeightKg - carrierCapacityKg);
  const weightRatio = totalWeightKg > 0 ? internalWeightKg / totalWeightKg : 1;
  const internalVolumeM3 = totalVolumeM3 * weightRatio;
  const subcontractVolumeM3 = totalVolumeM3 - internalVolumeM3;
  const internalQty = Math.round(totalQuantity * weightRatio);
  const subcontractQty = totalQuantity - internalQty;

  return {
    internalWeightKg,
    internalVolumeM3,
    subcontractWeightKg,
    subcontractVolumeM3,
    internalTrucks: suggestTruckAssignment(
      internalWeightKg,
      internalVolumeM3,
      internalQty
    ).assignments,
    subcontractTrucks:
      subcontractWeightKg > 0
        ? suggestTruckAssignment(subcontractWeightKg, subcontractVolumeM3, subcontractQty)
            .assignments
        : [],
  };
}

export function truckTypeFromLegacyVehicle(vehicleType: string): TruckType {
  const map: Record<string, TruckType> = {
    LARGE_TRUCK: TruckType.TEN_TON,
    TRAILER: TruckType.TEN_TON,
    MEDIUM_TRUCK: TruckType.MEDIUM,
    REFRIGERATED: TruckType.MEDIUM,
  };
  return map[vehicleType] ?? TruckType.MEDIUM;
}
