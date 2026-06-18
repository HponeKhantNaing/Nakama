'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { getYokomochiVehicleLabel } from '@/lib/yokomochi/vehicle-capacity';
import type { TruckType } from '@prisma/client';
import { formatDriverTaskStatus } from '@/lib/yokomochi/delivery-status';
import { useTranslation } from '@/lib/i18n/context';

export type DriverCompletedJobRow = {
  id: string;
  status: string;
  pickupLocation: string;
  destination: string;
  cargoType: string | null;
  boxes: number;
  pallets: number;
  createdAt: Date;
  arrivedFactoryAt: Date | null;
  loadedAt: Date | null;
  startedAt: Date | null;
  arrivedWarehouseAt: Date | null;
  completedAt: Date | null;
  trip: {
    tripCode: string;
    yokomochiOrder: { orderNo: string; productName: string | null };
  };
  truck: { truckNo: string | null; plateNumber: string; truckType: string } | null;
};

function formatTimestamp(value: Date | null | undefined) {
  return value ? formatDate(value) : '—';
}

export function DriverCompletedJobsTable({ rows }: { rows: DriverCompletedJobRow[] }) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('driver.noCompletedJobs')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('table.requestNo')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.tripCode')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('driver.pickup')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('driver.destination')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.cargoType')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.boxes')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.pallets')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.selectVehicle')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('table.status')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.assignedAt')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.arrivedFactory')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.loaded')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.inTransit')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.arrivedWarehouse')}
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.completedAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/15'}>
                <td className="border-r border-border/30 px-3 py-2 font-mono text-xs">
                  {row.trip.yokomochiOrder.orderNo}
                </td>
                <td className="border-r border-border/30 px-3 py-2 font-medium">{row.trip.tripCode}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">{row.pickupLocation}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">{row.destination}</td>
                <td className="border-r border-border/30 px-3 py-2">
                  {row.cargoType ?? row.trip.yokomochiOrder.productName ?? '—'}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-right tabular-nums">{row.boxes}</td>
                <td className="border-r border-border/30 px-3 py-2 text-right tabular-nums">{row.pallets}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">
                  {row.truck
                    ? `${row.truck.truckNo ?? row.truck.plateNumber} · ${getYokomochiVehicleLabel(row.truck.truckType as TruckType)}`
                    : '—'}
                </td>
                <td className="border-r border-border/30 px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">
                    {formatDriverTaskStatus(row.status)}
                  </Badge>
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.createdAt)}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.arrivedFactoryAt)}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.loadedAt)}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.startedAt)}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.arrivedWarehouseAt)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(row.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
