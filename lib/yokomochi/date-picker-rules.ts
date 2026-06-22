import { toLocalDateString } from '@/lib/yokomochi/dates';

export function getTodayDateString(): string {
  return toLocalDateString(new Date());
}

export function compareDateStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateBeforeToday(dateStr: string): boolean {
  return compareDateStrings(dateStr, getTodayDateString()) < 0;
}

export function isDateBeforeReference(dateStr: string, referenceDateStr: string): boolean {
  return compareDateStrings(dateStr, referenceDateStr) < 0;
}

export function clampDateNotBeforeToday(dateStr: string): string {
  const today = getTodayDateString();
  return isDateBeforeToday(dateStr) ? today : dateStr;
}

export const PICKUP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export function buildPickupDateTime(deliveryDate: string, hour: number): string {
  const h = String(hour).padStart(2, '0');
  return `${deliveryDate}T${h}:00:00`;
}
