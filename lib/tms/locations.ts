import { LatLng } from './routing';

export interface DeliveryLocation {
  id: string;
  labelEn: string;
  labelJa: string;
  lat: number;
  lng: number;
  region: 'kanto' | 'kansai' | 'chubu' | 'kyushu' | 'tohoku' | 'warehouse';
}

/** Predefined Japan delivery locations for accurate origin/destination selection */
export const DELIVERY_LOCATIONS: DeliveryLocation[] = [
  {
    id: 'tokyo-wh',
    labelEn: 'Tokyo — Maruichi Main Warehouse',
    labelJa: '東京 — 丸一倉庫 本社',
    lat: 35.6762,
    lng: 139.6503,
    region: 'warehouse',
  },
  {
    id: 'osaka',
    labelEn: 'Osaka',
    labelJa: '大阪',
    lat: 34.6937,
    lng: 135.5023,
    region: 'kansai',
  },
  {
    id: 'kyoto',
    labelEn: 'Kyoto',
    labelJa: '京都',
    lat: 35.0116,
    lng: 135.7681,
    region: 'kansai',
  },
  {
    id: 'kobe',
    labelEn: 'Kobe',
    labelJa: '神戸',
    lat: 34.6901,
    lng: 135.1956,
    region: 'kansai',
  },
  {
    id: 'nagoya',
    labelEn: 'Nagoya',
    labelJa: '名古屋',
    lat: 35.1815,
    lng: 136.9066,
    region: 'chubu',
  },
  {
    id: 'yokohama',
    labelEn: 'Yokohama',
    labelJa: '横浜',
    lat: 35.4437,
    lng: 139.638,
    region: 'kanto',
  },
  {
    id: 'fukuoka',
    labelEn: 'Fukuoka',
    labelJa: '福岡',
    lat: 33.5904,
    lng: 130.4017,
    region: 'kyushu',
  },
  {
    id: 'sapporo',
    labelEn: 'Sapporo',
    labelJa: '札幌',
    lat: 43.0618,
    lng: 141.3545,
    region: 'tohoku',
  },
  {
    id: 'hiroshima',
    labelEn: 'Hiroshima',
    labelJa: '広島',
    lat: 34.3853,
    lng: 132.4553,
    region: 'chubu',
  },
  {
    id: 'sendai',
    labelEn: 'Sendai',
    labelJa: '仙台',
    lat: 38.2682,
    lng: 140.8694,
    region: 'tohoku',
  },
];

export const WAREHOUSE_LOCATIONS = DELIVERY_LOCATIONS.filter((l) => l.region === 'warehouse');
export const DESTINATION_LOCATIONS = DELIVERY_LOCATIONS.filter((l) => l.region !== 'warehouse');

export function getLocationById(id: string): DeliveryLocation | undefined {
  return DELIVERY_LOCATIONS.find((l) => l.id === id);
}

export function locationLabel(loc: DeliveryLocation, locale: 'en' | 'ja' = 'ja'): string {
  return locale === 'ja' ? loc.labelJa : loc.labelEn;
}

export function locationCoords(loc: DeliveryLocation): LatLng {
  return { lat: loc.lat, lng: loc.lng };
}

/** Default kg per box when Maruichi only specifies box count */
export const DEFAULT_BOX_WEIGHT_KG = 10;

export function estimateWeightFromBoxes(boxCount: number, kgPerBox = DEFAULT_BOX_WEIGHT_KG): number {
  return boxCount * kgPerBox;
}
