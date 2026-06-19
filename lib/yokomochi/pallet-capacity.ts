/** Yokomochi standard: 1 pallet = 16 boxes */
export const BOXES_PER_PALLET = 16;

/** Full-truck pallet limits */
export const FOUR_TON_PALLETS = 5;
export const TEN_TON_PALLETS = 16;
export const FOUR_TON_BOXES = FOUR_TON_PALLETS * BOXES_PER_PALLET; // 80
export const TEN_TON_BOXES = TEN_TON_PALLETS * BOXES_PER_PALLET; // 256

const TRUCK_PALLET_LOADS = [FOUR_TON_PALLETS, TEN_TON_PALLETS] as const;

/** Exact pallet count when boxes align to whole pallets; otherwise fractional for display. */
export function palletsFromBoxes(boxes: number): number {
  if (boxes <= 0) return 0;
  return boxes / BOXES_PER_PALLET;
}

export function formatPalletsDisplay(boxes: number): string {
  const pallets = palletsFromBoxes(boxes);
  if (pallets <= 0) return '0';
  return Number.isInteger(pallets) ? String(pallets) : pallets.toFixed(1);
}

/** Whole pallets only (throws away fractional pallet remainder). */
export function wholePalletsFromBoxes(boxes: number): number {
  if (boxes <= 0 || boxes % BOXES_PER_PALLET !== 0) return 0;
  return boxes / BOXES_PER_PALLET;
}

/**
 * True when total pallets can be formed only from full 4t (5P) and 10t (16P) truck loads.
 */
export function isValidTruckPalletCombination(totalPallets: number): boolean {
  if (totalPallets <= 0) return false;

  const dp = new Array(totalPallets + 1).fill(false);
  dp[0] = true;

  for (let i = 1; i <= totalPallets; i++) {
    for (const load of TRUCK_PALLET_LOADS) {
      if (i >= load && dp[i - load]) {
        dp[i] = true;
        break;
      }
    }
  }

  return dp[totalPallets];
}

export function isValidOrderBoxQuantity(boxes: number): boolean {
  if (!Number.isInteger(boxes) || boxes <= 0) return false;
  if (boxes % BOXES_PER_PALLET !== 0) return false;
  return isValidTruckPalletCombination(boxes / BOXES_PER_PALLET);
}
