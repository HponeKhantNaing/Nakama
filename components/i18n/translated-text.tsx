'use client';

import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function TranslatedText({
  messageKey,
  className,
}: {
  messageKey: TranslationKey;
  className?: string;
}) {
  const { t } = useTranslation();
  return <p className={cn(className)}>{t(messageKey)}</p>;
}
