'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import {
  DRIVER_TASK_STEPS,
  formatDriverTaskStatus,
  getDeliveryTrackingStepIndex,
} from '@/lib/yokomochi/delivery-status';
import { useTranslation } from '@/lib/i18n/context';

export type YokomochiDeliveryTrackingRow = {
  orderNo: string;
  tripCode: string;
  partnerName: string;
  cargoType: string | null;
  boxes: number;
  pallets: number;
  pickupLocation: string;
  destination: string;
  driverName: string;
  driverPhone: string | null;
  driverEmail: string | null;
  vehicleLabel: string | null;
  plateNumber: string | null;
  taskStatus: string;
  tripStatus: string;
  verificationStatus: string | null;
  arrivedFactoryAt: Date | null;
  loadedAt: Date | null;
  startedAt: Date | null;
  arrivedWarehouseAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

function formatTimestamp(value: Date | null | undefined) {
  return value ? formatDate(value) : '—';
}

function DeliveryStepProgress({
  status,
  verificationStatus,
}: {
  status: string;
  verificationStatus?: string | null;
}) {
  const { t } = useTranslation();
  const currentIndex = getDeliveryTrackingStepIndex(status, verificationStatus);
  const labels = [
    t('delivery.stepAssigned'),
    t('delivery.stepArrivedFactory'),
    t('delivery.stepLoaded'),
    t('delivery.stepInTransit'),
    t('delivery.stepArrivedWarehouse'),
    t('delivery.stepCompleted'),
  ];

  return (
    <div className="flex min-w-[280px] items-center gap-0.5">
      {DRIVER_TASK_STEPS.map((step, index) => {
        const done = index <= currentIndex && status !== 'CANCELLED';
        const active = index === currentIndex;
        const awaitingWarehouse =
          status === 'ARRIVED_WAREHOUSE' &&
          verificationStatus !== 'APPROVED' &&
          index === DRIVER_TASK_STEPS.indexOf('ARRIVED_WAREHOUSE');
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                'h-2 w-full rounded-full',
                done ? 'bg-primary' : 'bg-muted',
                active && 'ring-2 ring-primary/40',
                awaitingWarehouse && 'bg-amber-400'
              )}
              title={labels[index]}
            />
            <span className="hidden text-[9px] text-muted-foreground xl:block">{labels[index]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function YokomochiDeliveryTrackingTable({ rows }: { rows: YokomochiDeliveryTrackingRow[] }) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('delivery.noActiveDeliveries')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('table.requestNo')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.tripCode')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.partner')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.selectDriver')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.phone')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.selectVehicle')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.route')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('carrier.boxes')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.currentStatus')}
              </th>
              <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('delivery.progress')}
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
                {t('delivery.lastUpdated')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.orderNo}-${row.tripCode}`} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/15'}>
                <td className="border-r border-border/30 px-3 py-2 font-mono text-xs">{row.orderNo}</td>
                <td className="border-r border-border/30 px-3 py-2 font-medium">{row.tripCode}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">{row.partnerName}</td>
                <td className="border-r border-border/30 px-3 py-2">{row.driverName}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">{row.driverPhone ?? '—'}</td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">
                  {row.vehicleLabel ?? '—'}
                  {row.plateNumber ? ` (${row.plateNumber})` : ''}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-xs">
                  {row.pickupLocation} → {row.destination}
                </td>
                <td className="border-r border-border/30 px-3 py-2 text-right tabular-nums">
                  {row.boxes}
                  <span className="text-muted-foreground"> / {row.pallets}P</span>
                </td>
                <td className="border-r border-border/30 px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">
                    {formatDriverTaskStatus(row.taskStatus)}
                    {row.taskStatus === 'ARRIVED_WAREHOUSE' &&
                      row.verificationStatus !== 'APPROVED' &&
                      ' · Awaiting scan'}
                    {row.verificationStatus === 'APPROVED' && ' · Verified'}
                  </Badge>
                </td>
                <td className="border-r border-border/30 px-3 py-2">
                  <DeliveryStepProgress
                    status={row.taskStatus}
                    verificationStatus={row.verificationStatus}
                  />
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
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatTimestamp(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
