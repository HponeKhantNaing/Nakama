'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, statusColor, formatDate } from '@/lib/utils';
import { MapPin, Package, Phone, Truck, User } from 'lucide-react';

export function ActiveDeliveryCard({
  requestNo,
  status,
  pickup,
  destination,
  expectedPickupDate,
  customerName,
  customerAddress,
  customerPhone,
  cargoType,
  boxes,
  weightKg,
  truckLabel,
}: {
  requestNo: string;
  status: string;
  pickup: string;
  destination: string;
  expectedPickupDate: Date;
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  cargoType: string | null;
  boxes: number;
  weightKg: number;
  truckLabel: string;
}) {
  return (
    <Card className="rounded-3xl border-primary/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{requestNo}</p>
            <p className="mt-1 text-lg font-bold">Active Delivery</p>
            <p className="mt-1 text-xs text-muted-foreground">Pickup time: {formatDate(expectedPickupDate)}</p>
          </div>
          <Badge className={cn('rounded-xl font-normal', statusColor(status))}>{status}</Badge>
        </div>

        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">Pickup Warehouse</p>
              <p className="font-semibold">{pickup}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
            <MapPin className="mt-0.5 h-5 w-5 text-blue-700" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Destination</p>
              <p className="font-semibold">{destination}</p>
              <p className="mt-1 text-xs text-muted-foreground">{customerAddress}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Customer</p>
              </div>
              <p className="mt-1 font-semibold">{customerName}</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Truck</p>
              </div>
              <p className="mt-1 font-semibold">{truckLabel}</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Phone</p>
              </div>
              <p className="mt-1 font-semibold">{customerPhone ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">Cargo</p>
              <p className="font-semibold">
                {cargoType ?? 'Products'} — {boxes} boxes ({weightKg} kg)
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

