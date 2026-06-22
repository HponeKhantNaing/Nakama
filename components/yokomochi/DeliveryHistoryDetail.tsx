'use client';

import { Button } from '@/components/ui/button';
import { DeliveryStepProgressBar } from '@/components/yokomochi/DeliveryStepProgressBar';
import { downloadDeliveryHistoryPdf } from '@/lib/yokomochi/generate-delivery-pdf';
import { useTranslation } from '@/lib/i18n/context';
import { Download } from 'lucide-react';

type TripTask = {
  status: string;
  boxes: number;
  pallets: number;
  pickupLocation: string;
  destination: string;
  arrivedFactoryAt: Date | string | null;
  loadedAt: Date | string | null;
  startedAt: Date | string | null;
  arrivedWarehouseAt: Date | string | null;
  completedAt: Date | string | null;
  driver: { name: string; phone: string | null };
  truck: { plateNumber: string | null } | null;
};

type Trip = {
  id: string;
  tripNo: number;
  tripCode: string;
  pallets: number;
  boxes: number;
  status: string;
  driverTask?: TripTask | null;
};

type OrderForHistory = {
  orderNo: string;
  status: string;
  cargoType: string | null;
  productName: string | null;
  completedAt?: Date | string | null;
  factoryRequest: {
    requestedPallets: number;
    requestedBoxes: number;
    requestedDate: Date | string;
    factoryCompany?: { name: string };
    warehouseCompany?: { name: string };
  } | null;
  trips?: Trip[];
  deliveryVerification?: { status: string } | null;
  deliveryForm?: { deliveryNo: string; approvedBy: string | null } | null;
};

function formatDateValue(
  value: Date | string | null | undefined,
  formatDate: (d: Date | string) => string
): string {
  if (!value) return '—';
  return formatDate(value);
}

export function DeliveryHistoryDetail({ order }: { order: OrderForHistory }) {
  const { t, formatDate, statusLabel, locale } = useTranslation();
  const fr = order.factoryRequest;
  const trips = (order.trips ?? []).filter((trip) => trip.driverTask);
  const factoryName = fr?.factoryCompany?.name ?? t('yokomochi.defaultFactory');
  const warehouseName = fr?.warehouseCompany?.name ?? t('yokomochi.defaultWarehouse');

  async function handleDownload() {
    if (!fr) return;
    await downloadDeliveryHistoryPdf(
      {
        orderNo: order.orderNo,
        status: statusLabel(order.status),
        productName: order.productName ?? t('yokomochi.defaultProduct'),
        cargoType: order.cargoType ?? t('yokomochi.defaultCargo'),
        factoryName,
        warehouseName,
        requestedPallets: fr.requestedPallets,
        requestedBoxes: fr.requestedBoxes,
        requestedDate: formatDate(fr.requestedDate),
        completedAt: order.completedAt ? formatDate(order.completedAt) : null,
        deliveryNo: order.deliveryForm?.deliveryNo ?? null,
        approvedBy: order.deliveryForm?.approvedBy ?? null,
        verificationStatus: order.deliveryVerification?.status ?? null,
        trips: trips.map((trip) => {
          const task = trip.driverTask!;
          return {
            tripCode: trip.tripCode,
            tripNo: trip.tripNo,
            pallets: task.pallets,
            boxes: task.boxes,
            status: trip.status,
            driverName: task.driver.name,
            driverPhone: task.driver.phone,
            plateNumber: task.truck?.plateNumber ?? null,
            pickupLocation: task.pickupLocation,
            destination: task.destination,
            taskStatus: statusLabel(task.status),
            arrivedFactoryAt: task.arrivedFactoryAt,
            loadedAt: task.loadedAt,
            startedAt: task.startedAt,
            arrivedWarehouseAt: task.arrivedWarehouseAt,
            completedAt: task.completedAt,
          };
        }),
        labels: {
          title: t('history.pdfTitle'),
          order: t('yokomochi.order'),
          status: t('table.status'),
          product: t('factory.productName'),
          factory: t('factory.factory'),
          warehouse: t('factory.warehouse'),
          requested: t('yokomochi.requested'),
          completed: t('history.completedAt'),
          deliveryForm: t('factory.deliveryFormNo'),
          approvedBy: t('factory.approvedBy'),
          trip: t('yokomochi.trips'),
          driver: t('carrier.driverColon'),
          truck: t('carrier.truckColon'),
          route: t('delivery.routeLabel'),
          timeline: t('history.timeline'),
          atFactory: t('delivery.stepArrivedFactory'),
          loaded: t('delivery.stepLoaded'),
          inTransit: t('delivery.stepInTransit'),
          atWarehouse: t('delivery.stepArrivedWarehouse'),
          done: t('delivery.stepCompleted'),
        },
      },
      locale
    );
  }

  if (trips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('history.deliveryTracking')}</p>
        <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t('history.downloadPdf')}
        </Button>
      </div>

      <div className="space-y-4">
        {trips.map((trip) => {
          const task = trip.driverTask!;
          return (
            <div key={trip.id} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">
                  {trip.tripCode} · {task.driver.name}
                  {task.truck?.plateNumber ? ` · ${task.truck.plateNumber}` : ''}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {task.pallets}P / {task.boxes} {t('carrier.boxes')}
                </p>
              </div>
              <DeliveryStepProgressBar
                status={task.status}
                verificationStatus={order.deliveryVerification?.status}
              />
              <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <span>
                  {t('delivery.stepArrivedFactory')}: {formatDateValue(task.arrivedFactoryAt, formatDate)}
                </span>
                <span>
                  {t('delivery.stepLoaded')}: {formatDateValue(task.loadedAt, formatDate)}
                </span>
                <span>
                  {t('delivery.stepInTransit')}: {formatDateValue(task.startedAt, formatDate)}
                </span>
                <span>
                  {t('delivery.stepArrivedWarehouse')}:{' '}
                  {formatDateValue(task.arrivedWarehouseAt, formatDate)}
                </span>
                <span>
                  {t('delivery.stepCompleted')}: {formatDateValue(task.completedAt, formatDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
