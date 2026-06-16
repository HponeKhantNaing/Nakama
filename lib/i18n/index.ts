import en, { type TranslationKey } from './translations/en';
import ja from './translations/ja';

export type Locale = 'en' | 'ja';

export const locales: Locale[] = ['ja', 'en'];
export const defaultLocale: Locale = 'ja';

const translations: Record<Locale, Record<TranslationKey, string>> = { en, ja };

export function getTranslation(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

export type { TranslationKey };
