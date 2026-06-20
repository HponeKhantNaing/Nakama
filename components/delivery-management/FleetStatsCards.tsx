'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

export type FleetStats = {
  total: number;
  pending: number;
  assigned: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
};

function StatCard({
  labelKey,
  value,
  tone,
}: {
  labelKey: TranslationKey;
  value: number;
  tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger';
}) {
  const { t } = useTranslation();
  const label = t(labelKey);
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : tone === 'info'
          ? 'bg-blue-50 text-blue-700'
          : tone === 'danger'
            ? 'bg-rose-50 text-rose-700'
            : 'bg-muted/40 text-foreground';

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Badge className={cn('rounded-xl border-0 px-3 py-1', toneClass)}>{label}</Badge>
      </CardContent>
    </Card>
  );
}

export function FleetStatsCards({ stats }: { stats: FleetStats }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
      <StatCard labelKey="shinwa.totalRequests" value={stats.total} tone="neutral" />
      <StatCard labelKey="status.PENDING" value={stats.pending} tone="warning" />
      <StatCard labelKey="status.ASSIGNED" value={stats.assigned} tone="info" />
      <StatCard labelKey="shinwa.inTransit" value={stats.inTransit} tone="info" />
      <StatCard labelKey="status.DELIVERED" value={stats.delivered} tone="success" />
      <StatCard labelKey="shinwa.cancelled" value={stats.cancelled} tone="danger" />
    </div>
  );
}
