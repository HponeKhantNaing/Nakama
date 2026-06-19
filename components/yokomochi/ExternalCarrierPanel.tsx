'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sendCarrierRequest } from '@/app/actions/yokomochi';
import { getCarrierEligibleTrips, countInternalFleetTrips } from '@/lib/yokomochi/carrier-allocation';
import { formatDate, cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';

type Schedule = {
  id: string;
  scheduleNo: number;
  deliveryDate: Date | string;
  boxes: number;
  totalTrips: number;
  status: string;
};

type CarrierReq = {
  id: string;
  deliveryScheduleId: string | null;
  deliveryDate: Date | null;
  requestedTrips: number;
  status: string;
  carrierCompany: { name: string };
  response?: {
    availableTrips: number;
    truckCount: number;
    driverCount: number;
    estimatedPickupTime: Date | null;
  } | null;
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalTrips: number;
  factoryRequest: { factoryCompany: { name: string } } | null;
  deliverySchedules?: Schedule[];
  trips: {
    id: string;
    deliveryScheduleId: string | null;
    tripCode: string;
    pallets: number;
    status: string;
    scheduledDate?: Date | string | null;
    internalFleetAssignment?: { driver: { name: string } } | null;
  }[];
  carrierRequests?: CarrierReq[];
};

export function ExternalCarrierPanel({
  orders,
  carriers,
}: {
  orders: Order[];
  carriers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [carrierId, setCarrierId] = useState(carriers[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  const actionable = orders.filter((o) => {
    const remaining = getCarrierEligibleTrips(o.trips).length;
    return remaining > 0 || (o.carrierRequests?.length ?? 0) > 0;
  });

  if (actionable.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No orders ready for external carrier. Schedule internal fleet first.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {actionable.map((order) => {
        const open = expanded === order.id;
        const internalCount = countInternalFleetTrips(order.trips);
        const schedules = order.deliverySchedules ?? [];

        return (
          <div key={order.id} className="border-b last:border-b-0">
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30', open && 'bg-muted/20')}
              onClick={() => setExpanded(open ? null : order.id)}
            >
              <span className="font-mono text-xs">{order.orderNo}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {order.factoryRequest?.factoryCompany.name ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Internal {internalCount} / {order.totalTrips} · {schedules.length} delivery date(s)
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {order.status.replace(/_/g, ' ')}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4 text-sm">
                {(schedules.length > 0 ? schedules : [{ id: '', scheduleNo: 0, deliveryDate: new Date(), boxes: 0, totalTrips: order.totalTrips, status: '' }]).map(
                  (schedule) => {
                    const scheduleTrips =
                      schedule.id
                        ? order.trips.filter((t) => t.deliveryScheduleId === schedule.id)
                        : order.trips;
                    const remaining = getCarrierEligibleTrips(scheduleTrips);
                    const cr = order.carrierRequests?.find(
                      (r) => r.deliveryScheduleId === schedule.id || (!schedule.id && !r.deliveryScheduleId)
                    );

                    return (
                      <div key={schedule.id || 'all'} className="rounded-lg border bg-white p-3">
                        {schedule.id && (
                          <p className="mb-2 font-medium">
                            Schedule {schedule.scheduleNo} · {formatDate(schedule.deliveryDate)} ·{' '}
                            {schedule.boxes} boxes · {remaining.length} trip(s) for Shinwa
                          </p>
                        )}
                        {cr ? (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
                            Sent to {cr.carrierCompany.name} — {cr.requestedTrips} trips · {cr.status}
                            {cr.deliveryDate && ` · ${formatDate(cr.deliveryDate)}`}
                          </div>
                        ) : remaining.length > 0 ? (
                          <div className="flex flex-wrap items-end gap-3">
                            <select
                              className="rounded-lg border px-3 py-2 text-sm"
                              value={carrierId}
                              onChange={(e) => setCarrierId(e.target.value)}
                            >
                              {carriers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              disabled={isPending || !carrierId}
                              onClick={() =>
                                startTransition(async () => {
                                  await sendCarrierRequest({
                                    yokomochiOrderId: order.id,
                                    deliveryScheduleId: schedule.id || undefined,
                                    carrierCompanyId: carrierId,
                                  });
                                  router.refresh();
                                })
                              }
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Send {remaining.length} trip(s) for this date
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">All trips assigned for this date.</p>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
