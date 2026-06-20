'use client';

import { useTranslation } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useTranslation();

  const options: { value: Locale; label: string }[] = [
    { value: 'ja', label: '日本語' },
    { value: 'en', label: 'EN' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl bg-muted/60 p-1 text-xs font-medium',
        className
      )}
      role="group"
      aria-label={t('lang.switch')}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLocale(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 transition-all duration-200',
            locale === opt.value
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
