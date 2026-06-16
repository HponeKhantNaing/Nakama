import { TruckStatus, TruckType } from '@prisma/client';
import { getTruckSpec } from './truck-assignment';

export interface AvailableTruck {
  id: string;
  truckNo?: string | null;
  truckNumber?: string;
  truckType: TruckType;
  capacityWeightKg: number;
  capacityVolumeM3: number;
  maxBoxes: number;
  status: TruckStatus;
}

export interface CargoLoad {
  totalWeight: number;
  totalQuantity: number;
  totalVolume?: number;
}

export interface TruckAllocationSlot {
  truckId: string;
  truckNo: string;
  truckType: TruckType;
  assignedWeight: number;
  assignedQuantity: number;
  remainingCapacityKg: number;
  remainingBoxes: number;
}

export interface AutoAllocationResult {
  allocations: TruckAllocationSlot[];
  remainingWeight: number;
  remainingQuantity: number;
  requiresSubcontract: boolean;
  subcontractSuggestion?: string;
  totalTrucksUsed: number;
}

function truckCaps(truck: AvailableTruck) {
  const spec = getTruckSpec(truck.truckType);
  return {
    kg: truck.capacityWeightKg || spec.capacityWeightKg,
    boxes: truck.maxBoxes || spec.maxBoxes,
    vol: truck.capacityVolumeM3 || spec.capacityVolumeM3,
  };
}

function truckLabel(truck: AvailableTruck): string {
  return truck.truckNo ?? truck.truckNumber ?? truck.id;
}

/**
 * Box-first allocation: e.g. 101 boxes → 96 (10T) + 5 (ban car).
 * Uses largest trucks first for bulk, smallest fitting truck for remainder.
 */
export function autoAllocateTrucks(
  cargo: CargoLoad,
  availableTrucks: AvailableTruck[]
): AutoAllocationResult {
  const eligible = availableTrucks.filter((t) => t.status === TruckStatus.AVAILABLE);
  const byBoxesDesc = [...eligible].sort(
    (a, b) => truckCaps(b).boxes - truckCaps(a).boxes
  );
  const byBoxesAsc = [...eligible].sort(
    (a, b) => truckCaps(a).boxes - truckCaps(b).boxes
  );

  let remainingWeight = cargo.totalWeight;
  let remainingQty = cargo.totalQuantity;
  let remainingVolume = cargo.totalVolume ?? 0;
  const kgPerBox = cargo.totalQuantity > 0 ? cargo.totalWeight / cargo.totalQuantity : 0;
  const allocations: TruckAllocationSlot[] = [];
  const used = new Set<string>();

  function pickTruck(
    pool: AvailableTruck[],
    predicate: (caps: ReturnType<typeof truckCaps>) => boolean
  ): AvailableTruck | undefined {
    return pool.find((t) => !used.has(t.id) && predicate(truckCaps(t)));
  }

  while (
    (remainingWeight > 0 || remainingQty > 0 || remainingVolume > 0) &&
    used.size < eligible.length
  ) {
    const capsFit = (c: ReturnType<typeof truckCaps>) =>
      remainingWeight <= c.kg &&
      remainingQty <= c.boxes &&
      (remainingVolume === 0 || remainingVolume <= c.vol);

    const exact = pickTruck(byBoxesAsc, capsFit);
    if (exact) {
      const c = truckCaps(exact);
      allocations.push({
        truckId: exact.id,
        truckNo: truckLabel(exact),
        truckType: exact.truckType,
        assignedWeight: remainingWeight,
        assignedQuantity: remainingQty,
        remainingCapacityKg: c.kg - remainingWeight,
        remainingBoxes: c.boxes - remainingQty,
      });
      used.add(exact.id);
      remainingWeight = 0;
      remainingQty = 0;
      break;
    }

    const loader =
      pickTruck(byBoxesDesc, (c) => c.boxes > 0 && c.kg > 0) ??
      pickTruck(byBoxesAsc, (c) => c.boxes > 0);

    if (!loader) break;

    const c = truckCaps(loader);
    const maxQtyByWeight = kgPerBox > 0 ? Math.floor(c.kg / kgPerBox) : c.boxes;
    const loadQty = Math.max(0, Math.min(remainingQty, c.boxes, maxQtyByWeight));
    const loadWeight = loadQty * kgPerBox;
    const loadVol =
      remainingVolume > 0 && remainingQty > 0 ? remainingVolume * (loadQty / remainingQty) : 0;

    if (loadQty === 0 && loadWeight === 0) break;

    allocations.push({
      truckId: loader.id,
      truckNo: truckLabel(loader),
      truckType: loader.truckType,
      assignedWeight: loadWeight,
      assignedQuantity: loadQty,
      remainingCapacityKg: c.kg - loadWeight,
      remainingBoxes: c.boxes - loadQty,
    });
    used.add(loader.id);
    remainingWeight = Math.max(0, remainingWeight - loadWeight);
    remainingQty = Math.max(0, remainingQty - loadQty);
    if (remainingVolume > 0) remainingVolume = Math.max(0, remainingVolume - loadVol);
  }

  const requiresSubcontract = remainingWeight > 0 || remainingQty > 0;

  return {
    allocations,
    remainingWeight,
    remainingQuantity: remainingQty,
    requiresSubcontract,
    subcontractSuggestion: requiresSubcontract
      ? `Insufficient fleet — forward ${remainingQty} boxes (${remainingWeight}kg) to subcontractor`
      : undefined,
    totalTrucksUsed: allocations.length,
  };
}
