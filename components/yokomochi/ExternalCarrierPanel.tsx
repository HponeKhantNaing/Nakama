'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sendCarrierRequest } from '@/app/actions/yokomochi';
import { getCarrierEligibleTrips } from '@/lib/yokomochi/carrier-allocation';
import { formatDate } from '@/lib/utils';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalTrips: number;
  createdAt: Date;
  factoryRequest: { factoryCompany: { name: string } } | null;
  trips: {
    id: string;
    tripNo: number;
    tripCode: string;
    pallets: number;
    status: string;
    internalFleetAssignment?: { driver: { name: string }; truck: { truckNo: string | null } } | null;
  }[];
  carrierRequest?: {
    id: string;
    requestedTrips: number;
    status: string;
    carrierCompany: { name: string };
    response?: {
      availableTrips: number;
      truckCount: number;
      driverCount: number;
      estimatedPickupTime: Date | null;
    } | null;
  } | null;
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
    return remaining > 0 || o.carrierRequest;
  });

  if (actionable.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No orders ready for external carrier. Complete internal fleet scheduling first.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {actionable.map((order) => {
        const open = expanded === order.id;
        const internalCount = order.trips.filter((t) => t.internalFleetAssignment).length;
        const remaining = getCarrierEligibleTrips(order.trips);
        const cr = order.carrierRequest;

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
                  Internal {internalCount} / {order.totalTrips} · Remaining {remaining.length}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {order.status.replace(/_/g, ' ')}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  {order.trips.map((t) => (
                    <div key={t.id} className="rounded-lg border bg-white px-3 py-2 text-xs">
                      <span className="font-mono">{t.tripCode}</span> · {t.pallets}p · {t.status}
                      {t.internalFleetAssignment && (
                        <span className="ml-1 text-muted-foreground">
                          ({t.internalFleetAssignment.driver.name})
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {cr ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="font-medium">Sent to {cr.carrierCompany.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested {cr.requestedTrips} trips · Status {cr.status}
                    </p>
                    {cr.response && (
                      <p className="mt-1 text-xs">
                        Carrier: {cr.response.availableTrips} trips, {cr.response.truckCount} trucks,{' '}
                        {cr.response.driverCount} drivers
                        {cr.response.estimatedPickupTime &&
                          ` · Pickup ${formatDate(cr.response.estimatedPickupTime)}`}
                      </p>
                    )}
                  </div>
                ) : remaining.length > 0 ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">建会社</label>
                      <select
                        className="block rounded-lg border px-3 py-2 text-sm"
                        value={carrierId}
                        onChange={(e) => setCarrierId(e.target.value)}
                      >
                        {carriers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      disabled={isPending || !carrierId}
                      onClick={() =>
                        startTransition(async () => {
                          await sendCarrierRequest({
                            yokomochiOrderId: order.id,
                            carrierCompanyId: carrierId,
                          });
                          router.refresh();
                        })
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send {remaining.length} Trip{remaining.length > 1 ? 's' : ''} to Carrier
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
