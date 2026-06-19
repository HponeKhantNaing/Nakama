/** Parse YYYY-MM-DD as local calendar date (avoids UTC midnight drift). */
export function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD in local timezone. */
export function toLocalDateString(value: Date | string): string {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Compare calendar day regardless of ISO timezone serialization. */
export function sameCalendarDate(value: Date | string, dateStr: string): boolean {
  return toLocalDateString(value) === dateStr;
}

/** Local start/end of day for schedule queries. */
export function localDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = parseLocalDateString(dateStr);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = parseLocalDateString(dateStr);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}

/** Pick the earliest delivery schedule date from orders, else today (local). */
export function earliestScheduleDate(
  dates: (Date | string | null | undefined)[],
  fallback = toLocalDateString(new Date())
): string {
  let best: string | null = null;
  for (const raw of dates) {
    if (!raw) continue;
    const key = toLocalDateString(raw);
    if (!best || key < best) best = key;
  }
  return best ?? fallback;
}
