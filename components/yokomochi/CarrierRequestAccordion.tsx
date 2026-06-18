'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitCarrierResponse } from '@/app/actions/yokomochi';
import { getCarrierEligibleTrips } from '@/lib/yokomochi/carrier-allocation';
import { formatDate, cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

type CarrierRequest = {
  id: string;
  requestedTrips: number;
  status: string;
  createdAt: Date;
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
    trips: {
      id: string;
      tripCode: string;
      pallets: number;
      status: string;
      internalFleetAssignment?: unknown | null;
      subcontractAssignment?: unknown | null;
    }[];
  };
};

export function CarrierRequestAccordion({ requests }: { requests: CarrierRequest[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No carrier requests yet.
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
                  {req.requestedTrips} trips requested · {formatDate(req.createdAt)}
                </p>
              </div>
              <Badge variant={req.status === 'PENDING' ? 'default' : 'outline'} className="text-[10px]">
                {req.status}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {order.cargoType ?? 'キーコーヒー'} · Total {order.totalTrips} trips · Carrier needs{' '}
                  <strong>{remaining.length || req.requestedTrips}</strong>
                </p>

                {hasResponse ? (
                  <div className="rounded-lg border bg-white p-3 text-sm">
                    <p className="font-medium">Your Response</p>
                    <p>
                      {req.response!.availableTrips} trips · {req.response!.truckCount} trucks ·{' '}
                      {req.response!.driverCount} drivers
                    </p>
                    {req.response!.estimatedPickupTime && (
                      <p className="text-xs text-muted-foreground">
                        Pickup: {formatDate(req.response!.estimatedPickupTime)}
                      </p>
                    )}
                  </div>
                ) : req.status === 'PENDING' ? (
                  <form
                    className="grid gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        await submitCarrierResponse({
                          carrierRequestId: req.id,
                          availableTrips: Number(fd.get('availableTrips')),
                          truckCount: Number(fd.get('truckCount')),
                          driverCount: Number(fd.get('driverCount')),
                          truckInfo: String(fd.get('truckInfo') || ''),
                          driverInfo: String(fd.get('driverInfo') || ''),
                          estimatedPickupTime: String(fd.get('estimatedPickupTime') || ''),
                          notes: String(fd.get('notes') || ''),
                        });
                        router.refresh();
                      });
                    }}
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`trips-${req.id}`}>Available Trips</Label>
                      <Input
                        id={`trips-${req.id}`}
                        name="availableTrips"
                        type="number"
                        min={0}
                        max={req.requestedTrips}
                        defaultValue={Math.min(2, req.requestedTrips)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`trucks-${req.id}`}>Truck Count</Label>
                      <Input id={`trucks-${req.id}`} name="truckCount" type="number" min={0} defaultValue={2} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`drivers-${req.id}`}>Driver Count</Label>
                      <Input id={`drivers-${req.id}`} name="driverCount" type="number" min={0} defaultValue={2} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pickup-${req.id}`}>Estimated Pickup</Label>
                      <Input id={`pickup-${req.id}`} name="estimatedPickupTime" type="datetime-local" required />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor={`truckinfo-${req.id}`}>Truck Info</Label>
                      <Input id={`truckinfo-${req.id}`} name="truckInfo" placeholder="10t x2" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor={`driverinfo-${req.id}`}>Driver Info</Label>
                      <Input id={`driverinfo-${req.id}`} name="driverInfo" placeholder="山田, 鈴木" />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                        Submit Response
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        If capacity &lt; requested, remaining trips auto-split to subcontractors.
                      </p>
                    </div>
                  </form>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
