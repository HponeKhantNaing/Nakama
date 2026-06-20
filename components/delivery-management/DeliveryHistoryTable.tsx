'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, statusColor } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/context';

type Row = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  deliveredAt: Date | null;
  truckAssignments?: { id: string; driver?: { id: string } | null }[];
  assignmentConfirmation?: { approved: boolean } | null;
};

export function DeliveryHistoryTable({ requests }: { requests: Row[] }) {
  const { t, formatDate, statusLabel } = useTranslation();

  const rows = useMemo(
    () => requests.filter((r) => ['DELIVERED', 'CANCELLED'].includes(r.status)),
    [requests]
  );

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-0">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">{t('delivery.historyTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('delivery.historyDesc')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">{t('table.request')}</th>
                <th className="px-5 py-3">{t('table.origin')}</th>
                <th className="px-5 py-3">{t('table.destination')}</th>
                <th className="px-5 py-3">{t('table.truckCount')}</th>
                <th className="px-5 py-3">{t('table.driverCount')}</th>
                <th className="px-5 py-3">{t('table.delivered')}</th>
                <th className="px-5 py-3">{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const truckCount = r.truckAssignments?.length ?? 0;
                const driverCount = new Set(
                  (r.truckAssignments ?? []).map((a) => a.driver?.id).filter(Boolean)
                ).size;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-4 font-mono text-xs font-medium">{r.requestNo}</td>
                    <td className="px-5 py-4">{r.origin}</td>
                    <td className="px-5 py-4">{r.destination}</td>
                    <td className="px-5 py-4">{truckCount}</td>
                    <td className="px-5 py-4">{driverCount}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {r.deliveredAt ? formatDate(r.deliveredAt) : '-'}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={cn('rounded-xl font-normal', statusColor(r.status))}>
                        {statusLabel(r.status)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-muted-foreground" colSpan={7}>
                    {t('delivery.noHistoryRows')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
