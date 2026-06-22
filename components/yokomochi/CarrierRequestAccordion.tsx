'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getCarrierEligibleTrips, countInternalFleetTrips } from '@/lib/yokomochi/carrier-allocation';
import { CarrierResponseForm } from '@/components/yokomochi/CarrierResponseForm';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/yokomochi/dates';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { ChevronDown, ChevronRight } from 'lucide-react';

type CarrierRequest = {
  id: string;
  requestedTrips: number;
  status: string;
  createdAt: Date;
  deliveryDate: Date | null;
  notes: string | null;
  response?: {
    availableTrips: number;
    truckCount: number;
    driverCount: number;
    truckInfo: string | null;
    driverInfo: string | null;
    estimatedPickupTime: Date | null;
  } | null;
  yokomochiOrder: {
    orderNo: string;
    totalTrips: number;
    cargoType: string | null;
    factoryRequest: {
      warehouseCompany: { name: string };
      factoryCompany: { name: string };
      requestedDate: Date;
    } | null;
    deliverySchedules?: { deliveryDate: Date }[];
    trips: {
      id: string;
      tripCode: string;
      pallets: number;
      status: string;
      deliveryScheduleId?: string | null;
      scheduledDate?: Date | null;
      internalFleetAssignment?: unknown | null;
      subcontractAssignment?: unknown | null;
    }[];
  };
};

export function CarrierRequestAccordion({ requests }: { requests: CarrierRequest[] }) {
  const { t, formatDate, statusLabel } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('carrier.noRequestsYet')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {requests.map((req) => {
        const open = expanded === req.id;
        const order = req.yokomochiOrder;
        const fr = order.factoryRequest;
        const remaining = getCarrierEligibleTrips(order.trips);
        const internalCount = countInternalFleetTrips(order.trips);
        const suggestedTrips = remaining.length > 0 ? remaining.length : req.requestedTrips;
        const hasResponse = !!req.response;

        return (
          <div key={req.id} className="border-b last:border-b-0">
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30', open && 'bg-muted/20')}
              onClick={() => setExpanded(open ? null : req.id)}
            >
              <span className="font-mono text-xs">{order.orderNo}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {fr?.warehouseCompany.name ?? '—'} ← {fr?.factoryCompany.name ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {interpolate(t('carrier.tripsRequested'), { count: req.requestedTrips })}
                  {(req.deliveryDate ?? req.yokomochiOrder.deliverySchedules?.[0]?.deliveryDate) &&
                    ` · ${formatDate(req.deliveryDate ?? req.yokomochiOrder.deliverySchedules![0].deliveryDate)}`}
                  {internalCount > 0 &&
                    ` · ${interpolate(t('carrier.internalCount'), { count: internalCount })}`}
                </p>
              </div>
              <Badge variant={req.status === 'PENDING' ? 'default' : 'outline'} className="text-[10px]">
                {statusLabel(req.status)}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {order.cargoType ?? t('yokomochi.defaultProduct')} ·{' '}
                  {interpolate(t('carrier.totalTrips'), { count: order.totalTrips })}
                  {internalCount > 0 &&
                    ` · ${interpolate(t('carrier.internalCount'), { count: internalCount })}`}{' '}
                  · {t('carrier.remainingForCarrier')}{' '}
                  <strong>{suggestedTrips}</strong>
                </p>

                {hasResponse ? (
                  <div className="rounded-lg border bg-white p-3 text-sm">
                    <p className="font-medium">{t('carrier.yourResponse')}</p>
                    <p>
                      {interpolate(t('carrier.tripSummary'), {
                        trips: req.response!.availableTrips,
                        trucks: req.response!.truckCount,
                        drivers: req.response!.driverCount,
                      })}
                    </p>
                    {req.response!.estimatedPickupTime && (
                      <p className="text-xs text-muted-foreground">
                        {interpolate(t('carrier.pickupAt'), {
                          time: formatDate(req.response!.estimatedPickupTime),
                        })}
                      </p>
                    )}
                  </div>
                ) : req.status === 'PENDING' ? (
                  <CarrierResponseForm
                    requestId={req.id}
                    suggestedTrips={suggestedTrips}
                    deliveryDate={toLocalDateString(
                      req.deliveryDate ??
                        req.yokomochiOrder.deliverySchedules?.[0]?.deliveryDate ??
                        fr?.requestedDate ??
                        new Date()
                    )}
                  />
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
