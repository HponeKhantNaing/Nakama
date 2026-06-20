import type { TranslationKey } from './index';

export function translateStatus(
  status: string,
  t: (key: TranslationKey) => string
): string {
  const key = `status.${status}` as TranslationKey;
  const translated = t(key);
  return translated === key ? status.replace(/_/g, ' ') : translated;
}
