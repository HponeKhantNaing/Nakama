'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  defaultLocale,
  formatLocaleDate,
  getTranslation,
  translateStatus,
  type Locale,
  type TranslationKey,
} from './index';

const STORAGE_KEY = 'mtms-locale';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  formatDate: (date: Date | string | null | undefined) => string;
  statusLabel: (status: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'en' || stored === 'ja') {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, mounted]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => getTranslation(locale, key),
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | null | undefined) => formatLocaleDate(date, locale),
    [locale]
  );

  const statusLabel = useCallback(
    (status: string) => translateStatus(status, t),
    [t]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, formatDate, statusLabel }),
    [locale, setLocale, t, formatDate, statusLabel]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return ctx;
}
