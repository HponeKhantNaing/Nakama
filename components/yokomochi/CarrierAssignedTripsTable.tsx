'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { getYokomochiVehicleLabel } from '@/lib/yokomochi/vehicle-capacity';
import { useTranslation } from '@/lib/i18n/context';
import type { CarrierAcceptedJobGroup } from '@/app/actions/carrier-fleet';

export type AssignedTripRow = CarrierAcceptedJobGroup['trips'][number] & {
  orderNo: string;
  cargoType: string | null;
};

export function collectAssignedTripRows(groups: CarrierAcceptedJobGroup[]): AssignedTripRow[] {
  return groups
    .flatMap((group) =>
      group.trips
        .filter((trip) => trip.status === 'DRIVER_ASSIGNED' && trip.driverTask)
        .map((trip) => ({
          ...trip,
          orderNo: group.orderNo,
          cargoType: group.cargoType,
        }))
    )
    .sort((a, b) => {
      const aTime = a.driverTask?.createdAt?.getTime() ?? 0;
      const bTime = b.driverTask?.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export function CarrierAssignedTripsTable({ groups }: { groups: CarrierAcceptedJobGroup[] }) {
  const { t } = useTranslation();
  const rows = collectAssignedTripRows(groups);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('carrier.assignedJobsTable')}</p>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('table.requestNo')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.tripCode')}
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
                  {t('carrier.selectDriver')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.email')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.phone')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.selectVehicle')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.vehicleType')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.plateNumber')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.route')}
                </th>
                <th className="border-r border-border/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('table.status')}
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('carrier.assignedAt')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((trip, index) => {
                const task = trip.driverTask!;
                const truck = task.truck;
                return (
                  <tr
                    key={trip.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-muted/15'}
                  >
                    <td className="border-r border-border/30 px-3 py-2 font-mono text-xs">
                      {trip.orderNo}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 font-medium">
                      {trip.tripCode}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2">
                      {task.cargoType ?? trip.cargoType ?? '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-right tabular-nums">
                      {trip.boxes}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-right tabular-nums">
                      {trip.pallets}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2">{task.driver.name}</td>
                    <td className="border-r border-border/30 px-3 py-2 text-xs">
                      {task.driver.email ?? '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-xs">
                      {task.driver.phone ?? '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2">
                      {truck?.truckNo ?? truck?.plateNumber ?? '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-xs">
                      {truck ? getYokomochiVehicleLabel(truck.truckType) : '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-xs">
                      {truck?.plateNumber ?? '—'}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2 text-xs">
                      {task.pickupLocation} → {task.destination}
                    </td>
                    <td className="border-r border-border/30 px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(task.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
