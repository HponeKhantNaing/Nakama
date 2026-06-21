'use client';

import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { buildMultiTripRowMeta } from '@/lib/yokomochi/multi-trip-tracking';
import { DeliveryStepProgressBar } from '@/components/yokomochi/DeliveryStepProgressBar';
import { useTranslation } from '@/lib/i18n/context';

export type YokomochiDeliveryTrackingRow = {
  orderNo: string;
  tripCode: string;
  tripNo: number;
  driverId: string;
  truckId: string | null;
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
  truckType: string | null;
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

const CELL_BASE =
  'whitespace-normal break-words px-4 py-3 text-sm leading-relaxed text-left';

const TH =
  'whitespace-normal break-words border-r border-border/40 px-4 py-3 text-left text-xs font-semibold uppercase leading-relaxed tracking-wide text-muted-foreground last:border-r-0 align-top';

function TrackCell({
  children,
  align = 'left',
  className,
  minWidth = 'min-w-[120px]',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  minWidth?: string;
}) {
  return (
    <td className={cn('align-top border-r border-border/30 last:border-r-0', minWidth)}>
      <div
        className={cn(
          CELL_BASE,
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
          className
        )}
      >
        {children}
      </div>
    </td>
  );
}

export function YokomochiDeliveryTrackingTable({ rows }: { rows: YokomochiDeliveryTrackingRow[] }) {
  const { t, formatDate, statusLabel, truckLabel } = useTranslation();

  function formatTimestamp(value: Date | null | undefined) {
    return value ? formatDate(value) : '—';
  }

  const multiTripMeta = useMemo(() => buildMultiTripRowMeta(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('delivery.noActiveDeliveries')}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border/60 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className={cn(TH, 'min-w-[120px]')}>{t('table.requestNo')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('carrier.tripCode')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('delivery.partner')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('carrier.selectDriver')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('carrier.phone')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('carrier.selectVehicle')}</th>
            <th className={cn(TH, 'min-w-[140px]')}>{t('carrier.route')}</th>
            <th className={cn(TH, 'min-w-[100px] text-right')}>{t('carrier.boxes')}</th>
            <th className={cn(TH, 'min-w-[140px]')}>{t('delivery.currentStatus')}</th>
            <th className={cn(TH, 'min-w-[180px]')}>{t('delivery.progress')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('delivery.arrivedFactory')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('delivery.loaded')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('delivery.inTransit')}</th>
            <th className={cn(TH, 'min-w-[120px]')}>{t('delivery.arrivedWarehouse')}</th>
            <th className={cn(TH, 'min-w-[120px] border-r-0')}>{t('delivery.lastUpdated')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const legMeta = multiTripMeta.get(row.tripCode);
            const showProgress = legMeta?.showProgress ?? true;
            const displayStatus = showProgress
              ? (legMeta?.progressStatus ?? row.taskStatus)
              : row.taskStatus;

            return (
              <tr key={`${row.orderNo}-${row.tripCode}`} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/15'}>
                <TrackCell className="font-mono text-xs">{row.orderNo}</TrackCell>
                <TrackCell className="font-medium">{row.tripCode}</TrackCell>
                <TrackCell className="text-xs">{row.partnerName}</TrackCell>
                <TrackCell>{row.driverName}</TrackCell>
                <TrackCell className="text-xs">{row.driverPhone ?? '—'}</TrackCell>
                <TrackCell className="text-xs" minWidth="min-w-[140px]">
                  {row.truckType ? truckLabel(row.truckType) : (row.vehicleLabel ?? '—')}
                  {row.plateNumber ? ` (${row.plateNumber})` : ''}
                </TrackCell>
                <TrackCell className="text-xs" minWidth="min-w-[140px]">
                  {row.pickupLocation} → {row.destination}
                </TrackCell>
                <TrackCell align="right" className="tabular-nums" minWidth="min-w-[100px]">
                  {row.boxes}
                  <span className="text-muted-foreground"> / {row.pallets}P</span>
                </TrackCell>
                <TrackCell minWidth="min-w-[140px]">
                  <Badge
                    variant="outline"
                    className="h-auto whitespace-normal break-words text-left text-[10px] leading-relaxed"
                  >
                    {statusLabel(displayStatus)}
                    {displayStatus === 'ARRIVED_WAREHOUSE' &&
                      (legMeta?.progressVerificationStatus ?? row.verificationStatus) !== 'APPROVED' &&
                      ` · ${t('delivery.awaitingScan')}`}
                    {row.taskStatus === 'COMPLETED' && ` · ${t('delivery.verified')}`}
                  </Badge>
                </TrackCell>
                <TrackCell minWidth="min-w-[180px]">
                  {showProgress ? (
                    <DeliveryStepProgressBar
                      status={legMeta?.progressStatus ?? row.taskStatus}
                      verificationStatus={legMeta?.progressVerificationStatus ?? row.verificationStatus}
                      bulletNumber={legMeta?.bulletNumber}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TrackCell>
                <TrackCell className="text-xs text-muted-foreground">
                  {formatTimestamp(row.arrivedFactoryAt)}
                </TrackCell>
                <TrackCell className="text-xs text-muted-foreground">{formatTimestamp(row.loadedAt)}</TrackCell>
                <TrackCell className="text-xs text-muted-foreground">{formatTimestamp(row.startedAt)}</TrackCell>
                <TrackCell className="text-xs text-muted-foreground">
                  {formatTimestamp(row.arrivedWarehouseAt)}
                </TrackCell>
                <TrackCell className="text-xs text-muted-foreground">{formatTimestamp(row.updatedAt)}</TrackCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
