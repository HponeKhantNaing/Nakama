'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

export function DriverStatsCard({
  stats,
}: {
  stats: {
    completedDeliveries: number;
    activeDeliveries: number;
    pendingDeliveries: number;
    totalBoxesDelivered: number;
    totalWeightDelivered: number;
  };
}) {
  const { t } = useTranslation();

  const items: { labelKey: TranslationKey; value: number }[] = [
    { labelKey: 'delivery.statCompleted', value: stats.completedDeliveries },
    { labelKey: 'delivery.statActive', value: stats.activeDeliveries },
    { labelKey: 'delivery.statPending', value: stats.pendingDeliveries },
    { labelKey: 'delivery.statBoxesDelivered', value: stats.totalBoxesDelivered },
    { labelKey: 'delivery.statWeightDelivered', value: stats.totalWeightDelivered },
  ];

  return (
    <Card className="rounded-3xl">
      <CardContent className="p-4">
        <p className="text-sm font-semibold">{t('delivery.todaySummary')}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {items.map((item) => (
            <div key={item.labelKey} className="rounded-2xl bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">{t(item.labelKey)}</p>
              <p className="mt-1 text-lg font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
