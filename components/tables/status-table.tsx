'use client';

import { cn, statusColor, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

type RequestRow = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  updatedAt: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle?: { plateNumber: string } | null;
    truck?: { plateNumber: string; truckNo?: string | null } | null;
  } | null;
  truckAssignments?: {
    driver?: { name: string } | null;
    truck?: { truckNo: string | null; plateNumber: string } | null;
  }[];
};

interface StatusTableProps {
  requests: RequestRow[];
  actions?: (request: RequestRow) => React.ReactNode;
}

export function StatusTable({ requests, actions }: StatusTableProps) {
  const { t } = useTranslation();

  function statusLabel(status: string): string {
    const key = `status.${status}` as TranslationKey;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-muted-foreground shadow-card">
        {t('table.noRequests')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
      <div className="-mx-px overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.requestNo')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.origin')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.destination')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.status')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.driver')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.vehicle')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                {t('table.updated')}
              </th>
              {actions && (
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5 sm:py-4">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              (() => {
                const firstAssignment = req.truckAssignments?.[0];
                const driverName =
                  firstAssignment?.driver?.name ??
                  req.tripAllocation?.driver.name ??
                  '-';
                const vehicleLabel =
                  firstAssignment?.truck?.truckNo ??
                  firstAssignment?.truck?.plateNumber ??
                  req.tripAllocation?.truck?.truckNo ??
                  req.tripAllocation?.truck?.plateNumber ??
                  req.tripAllocation?.vehicle?.plateNumber ??
                  '-';

                return (
              <tr
                key={req.id}
                className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20"
              >
                <td className="px-5 py-4 font-mono text-xs font-medium">{req.requestNo}</td>
                <td className="px-5 py-4">{req.origin}</td>
                <td className="px-5 py-4">{req.destination}</td>
                <td className="px-5 py-4">
                  <Badge className={cn('rounded-lg font-normal', statusColor(req.status))}>
                    {statusLabel(req.status)}
                  </Badge>
                </td>
                <td className="px-5 py-4">{driverName}</td>
                <td className="px-5 py-4">{vehicleLabel}</td>
                <td className="px-5 py-4 text-muted-foreground">{formatDate(req.updatedAt)}</td>
                {actions && <td className="px-5 py-4">{actions(req)}</td>}
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
