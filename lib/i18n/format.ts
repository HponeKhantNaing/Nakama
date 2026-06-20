import type { Locale } from './index';

export function formatLocaleDate(
  date: Date | string | null | undefined,
  locale: Locale
): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
