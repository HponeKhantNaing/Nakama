import type { TranslationKey } from './index';

export function translateTruckType(
  type: string,
  t: (key: TranslationKey) => string
): string {
  if (!type || type === '—') return type;

  const truckKey = `truck.${type}` as TranslationKey;
  const truck = t(truckKey);
  if (truck !== truckKey) return truck;

  const vehicleKey = `vehicle.${type}` as TranslationKey;
  const vehicle = t(vehicleKey);
  if (vehicle !== vehicleKey) return vehicle;

  return type.replace(/_/g, ' ');
}
