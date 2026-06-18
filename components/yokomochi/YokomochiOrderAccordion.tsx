'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDate } from '@/lib/utils';
import { handleNegotiation, verifyWarehouseDelivery, confirmOrderTrips } from '@/app/actions/yokomochi';
import { calculateTripsFromPallets } from '@/lib/yokomochi/trip-calculation';
import { ChevronDown, ChevronRight, ArrowRight, Truck } from 'lucide-react';

const BOXES_PER_PALLET = 16;
const DEFAULT_REQUESTED_BOXES = '500';

function calculatePalletsFromBoxes(boxes: number) {
  return Math.ceil(Math.max(0, boxes) / BOXES_PER_PALLET);
}

function isPositiveIntegerInput(value: string) {
  return value === '' || /^[1-9]\d*$/.test(value);
}

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalTrips: number;
  remainderPallets: number;
  cargoType: string | null;
  productName: string | null;
  createdAt: Date;
  factoryRequest: {
    requestedPallets: number;
    requestedBoxes: number;
    requestedDate: Date;
    factoryCompany?: { name: string };
    warehouseCompany?: { name: string };
  } | null;
  factoryResponse?: {
    availablePallets: number;
    availableBoxes: number;
    negotiationStatus: string;
    availableDate: Date;
  } | null;
  negotiationHistory: { action: string; message: string | null; createdAt: Date }[];
  trips?: { id: string; tripNo: number; tripCode: string; pallets: number; status: string }[];
  deliveryVerification?: { status: string; notes: string | null } | null;
  deliveryForm?: { deliveryNo: string; approvedBy: string | null } | null;
};

function requestPartnerName(
  fr: Order['factoryRequest'],
  mode: 'warehouse' | 'factory' | 'negotiations' | 'history'
): string {
  if (!fr) return '—';
  if (mode === 'factory') {
    return fr.warehouseCompany?.name ?? '20号物流センター';
  }
  return fr.factoryCompany?.name ?? '飲料工場';
}

function needsTripCalculation(order: Order): boolean {
  const trips = order.trips ?? [];
  return !!order.factoryResponse && trips.length === 0 && order.status !== 'CANCELLED';
}

function warehouseNextStep(order: Order): { label: string; href?: string; action?: 'confirm-trips' } | null {
  const trips = order.trips ?? [];
  if (needsTripCalculation(order)) {
    return { label: '配車便数を計算', action: 'confirm-trips' };
  }
  if (
    ['TRIPS_CALCULATED', 'INTERNAL_SCHEDULING', 'APPROVED'].includes(order.status) &&
    trips.length > 0
  ) {
    return { label: '内部フリート配車へ', href: '/warehouse/internal-fleet' };
  }
  if (['CARRIER_PENDING', 'SUBCONTRACTING', 'DRIVER_ASSIGNED'].includes(order.status)) {
    return { label: '建会社依頼を確認', href: '/warehouse/external-carrier' };
  }
  if (order.status === 'AWAITING_VERIFICATION') {
    return { label: '到着確認が必要', action: undefined };
  }
  return null;
}

export function YokomochiOrderAccordion({
  orders,
  mode,
}: {
  orders: Order[];
  mode: 'warehouse' | 'factory' | 'negotiations' | 'history';
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered =
    mode === 'negotiations'
      ? orders.filter((o) => ['NEGOTIATING', 'FACTORY_PENDING'].includes(o.status))
      : mode === 'history'
        ? orders.filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status))
        : orders;

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No records found.
      </div>
    );
  }

  const pendingWarehouse = mode === 'warehouse' ? filtered.filter(needsTripCalculation) : [];

  return (
    <div className="space-y-4">
      {pendingWarehouse.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">次のステップ</p>
          <p className="mt-1 text-xs">
            工場承認済みですが配車便が未計算です。下の「配車便数を計算」を押すか、行を展開して続行してください。
          </p>
        </div>
      )}
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase text-muted-foreground md:grid md:grid-cols-[120px_1fr_80px_100px_80px_32px] md:gap-3">
        <span>Order</span>
        <span>Product / {mode === 'factory' ? 'Warehouse' : 'Factory'}</span>
        <span>Pallets</span>
        <span>Status</span>
        <span>Trips</span>
        <span />
      </div>

      {filtered.map((order) => {
        const open = expanded === order.id;
        const fr = order.factoryRequest;
        const res = order.factoryResponse;
        const calc = res ? calculateTripsFromPallets(res.availablePallets) : null;
        if (!fr) return null;
        const partner = requestPartnerName(fr, mode);
        const trips = order.trips ?? [];
        const next = mode === 'warehouse' ? warehouseNextStep(order) : null;

        return (
          <div key={order.id} className="border-b last:border-b-0">
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30', open && 'bg-muted/20')}
              onClick={() => setExpanded(open ? null : order.id)}
            >
              <span className="hidden w-[120px] font-mono text-xs md:block">{order.orderNo}</span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-muted-foreground md:hidden">{order.orderNo}</p>
                <p className="truncate text-sm font-medium">
                  {order.productName ?? order.cargoType ?? 'キーコーヒー'} · {partner}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
              </div>
              <span className="hidden w-[80px] text-sm md:block">{fr.requestedPallets}</span>
              <span className="hidden w-[100px] md:block">
                <Badge variant="outline" className="text-[10px]">
                  {order.status.replace(/_/g, ' ')}
                </Badge>
              </span>
              <span className="hidden w-[80px] text-sm font-medium md:block">{order.totalTrips || trips.length || '—'}</span>
              {mode === 'warehouse' && next && (
                <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  {next.action === 'confirm-trips' ? (
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await confirmOrderTrips(order.id);
                          router.refresh();
                        })
                      }
                    >
                      {next.label}
                    </Button>
                  ) : next.href ? (
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                      <Link href={next.href}>
                        <Truck className="mr-1 h-3 w-3" />
                        {next.label}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              )}
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Requested</p>
                    <p>{fr.requestedPallets} pallets · {fr.requestedBoxes} boxes</p>
                    <p className="text-xs">{formatDate(fr.requestedDate)}</p>
                  </div>
                  {res && (
                    <div>
                      <p className="text-xs text-muted-foreground">Factory Response</p>
                      <p>
                        {res.availablePallets} pallets · {res.negotiationStatus}
                      </p>
                      {calc && (
                        <p className="text-xs text-primary">
                          Auto: {calc.totalTrips} trips, remainder {calc.remainderPallets}
                        </p>
                      )}
                    </div>
                  )}
                  {trips.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Trips</p>
                      {trips.map((t) => (
                        <p key={t.id} className="text-xs">
                          {t.tripCode}: {t.pallets}p · {t.status}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {order.negotiationHistory?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Negotiation History</p>
                    <div className="space-y-1">
                      {order.negotiationHistory.map((h, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {formatDate(h.createdAt)} — {h.action}
                          {h.message ? `: ${h.message}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {mode === 'warehouse' && needsTripCalculation(order) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="mb-2 text-sm font-semibold">Step 2 — 配車便数の自動計算</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {res?.availablePallets ?? '—'} パレット ÷ 16 ={' '}
                      {res ? calculateTripsFromPallets(res.availablePallets).totalTrips : '—'} 便
                    </p>
                    <Button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await confirmOrderTrips(order.id);
                          router.refresh();
                        })
                      }
                    >
                      配車便数を計算して続行
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {mode === 'warehouse' &&
                  ['TRIPS_CALCULATED', 'INTERNAL_SCHEDULING'].includes(order.status) &&
                  trips.length > 0 && (
                    <div className="rounded-lg border bg-white p-4">
                      <p className="mb-2 text-sm font-semibold">Step 3 — 社内フリート配車</p>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {trips.length} 便を小野・浅川のタイムラインに割り当ててください。
                      </p>
                      <Button asChild>
                        <Link href="/warehouse/internal-fleet">
                          内部フリートへ
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )}

                {mode === 'warehouse' && res?.negotiationStatus === 'PARTIAL' && order.status === 'NEGOTIATING' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({ yokomochiOrderId: order.id, action: 'APPROVE' });
                          router.refresh();
                        })
                      }
                    >
                      Approve Partial
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({ yokomochiOrderId: order.id, action: 'REQUEST_AGAIN' });
                          router.refresh();
                        })
                      }
                    >
                      Request Again
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({ yokomochiOrderId: order.id, action: 'REJECT' });
                          router.refresh();
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {mode === 'warehouse' && order.status === 'AWAITING_VERIFICATION' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await verifyWarehouseDelivery({ yokomochiOrderId: order.id, approved: true });
                          router.refresh();
                        })
                      }
                    >
                      Approve Arrival
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await verifyWarehouseDelivery({
                            yokomochiOrderId: order.id,
                            approved: false,
                            notes: 'Rejected at warehouse',
                          });
                          router.refresh();
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {order.deliveryForm && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs font-semibold">横持輸送確認書 (Digital)</p>
                    <p className="text-xs">No: {order.deliveryForm.deliveryNo}</p>
                    <p className="text-xs">Approved by: {order.deliveryForm.approvedBy}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

export function CreateFactoryRequestForm({
  factories,
}: {
  factories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requestedBoxes, setRequestedBoxes] = useState(DEFAULT_REQUESTED_BOXES);
  const requestedBoxCount = Number(requestedBoxes) || 0;
  const requestedPallets = calculatePalletsFromBoxes(requestedBoxCount);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const boxes = Number(fd.get('requestedBoxes'));
    setError(null);
    startTransition(async () => {
      const { createFactoryRequest } = await import('@/app/actions/yokomochi');
      const result = await createFactoryRequest({
        factoryCompanyId: String(fd.get('factoryCompanyId')),
        requestedPallets: calculatePalletsFromBoxes(boxes),
        requestedBoxes: boxes,
        requestedDate: String(fd.get('requestedDate')),
        cargoType: String(fd.get('cargoType') || ''),
        productName: String(fd.get('productName') || ''),
        notes: String(fd.get('notes') || ''),
      });
      if (!result.success) {
        setError(result.error ?? 'Failed');
        return;
      }
      router.refresh();
      (e.target as HTMLFormElement).reset();
      setRequestedBoxes(DEFAULT_REQUESTED_BOXES);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Factory</Label>
        <select name="factoryCompanyId" required className="w-full rounded-lg border px-3 py-2 text-sm">
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Product Name</Label>
        <Input name="productName" placeholder="キーコーヒー" defaultValue="キーコーヒー" />
      </div>
      <div className="space-y-2">
        <Label>Cargo Type</Label>
        <Input name="cargoType" placeholder="飲料" defaultValue="飲料" />
      </div>
      <div className="space-y-2">
        <Label>Boxes</Label>
        <Input
          name="requestedBoxes"
          type="number"
          min={1}
          required
          value={requestedBoxes}
          onChange={(event) => {
            if (isPositiveIntegerInput(event.target.value)) {
              setRequestedBoxes(event.target.value);
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>Pallets</Label>
        {/* Pallets are derived from boxes so arrow-key and stepper changes stay in sync. */}
        <Input name="requestedPallets" type="number" readOnly value={requestedPallets} />
      </div>
      <div className="space-y-2">
        <Label>Requested Date</Label>
        <Input name="requestedDate" type="date" required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Notes</Label>
        <Input name="notes" placeholder="Optional" />
      </div>
      {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending} className="rounded-xl">
          {isPending ? 'Sending...' : 'Send Factory Request'}
        </Button>
      </div>
    </form>
  );
}
