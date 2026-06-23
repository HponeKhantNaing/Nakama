import { MARUICHI_LOGISTICS_CENTER_JA } from '@/lib/company';

/** 10t truck capacity — Key Coffee yokomochi standard */
export const PALLETS_PER_TEN_TON_TRIP = 16;

export const YOKOMOCHI_LOCATIONS = {
  warehouse: MARUICHI_LOGISTICS_CENTER_JA,
  factory: '飲料工場（キーコーヒー）',
  warehouseAddress: '愛知県',
  factoryAddress: '工場所在地',
} as const;
