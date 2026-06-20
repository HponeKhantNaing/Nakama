'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { handleNegotiation, verifyWarehouseDelivery, confirmOrderTrips } from '@/app/actions/yokomochi';
import { calculateTripsFromPallets } from '@/lib/yokomochi/trip-calculation';
import { ChevronDown, ChevronRight, ArrowRight, Truck } from 'lucide-react';
import { BusinessDeliveryCalendar } from '@/components/yokomochi/BusinessDeliveryCalendar';
import {
  formatPalletsDisplay,
  isValidOrderBoxQuantity,
  wholePalletsFromBoxes,
} from '@/lib/yokomochi/pallet-capacity';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

const DEFAULT_REQUESTED_BOXES = '400';

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
  factoryNegotiation?: {
    requestedBoxes: number;
    availableBoxes: number;
    remainingBoxes: number;
    availableDate: Date;
    nextAvailableDate: Date | null;
    status: string;
  } | null;
  deliverySchedules?: {
    id: string;
    scheduleNo: number;
    deliveryDate: Date;
    boxes: number;
    pallets: number;
    totalTrips: number;
    status: string;
  }[];
  negotiationHistory: { action: string; message: string | null; createdAt: Date }[];
  trips?: { id: string; tripNo: number; tripCode: string; pallets: number; status: string }[];
  deliveryVerification?: { status: string; notes: string | null } | null;
  deliveryForm?: { deliveryNo: string; approvedBy: string | null } | null;
};

function requestPartnerName(
  fr: Order['factoryRequest'],
  mode: 'warehouse' | 'factory' | 'negotiations' | 'history',
  t: (key: TranslationKey) => string
): string {
  if (!fr) return '—';
  if (mode === 'factory') {
    return fr.warehouseCompany?.name ?? t('yokomochi.defaultWarehouse');
  }
  return fr.factoryCompany?.name ?? t('yokomochi.defaultFactory');
}

function needsTripCalculation(order: Order): boolean {
  const trips = order.trips ?? [];
  return !!order.factoryResponse && trips.length === 0 && order.status !== 'CANCELLED';
}

function warehouseNextStep(
  order: Order
): { labelKey: TranslationKey; href?: string; action?: 'confirm-trips' } | null {
  const trips = order.trips ?? [];
  if (needsTripCalculation(order)) {
    return { labelKey: 'yokomochi.calcTrips', action: 'confirm-trips' };
  }
  if (
    ['TRIPS_CALCULATED', 'INTERNAL_SCHEDULING', 'APPROVED'].includes(order.status) &&
    trips.length > 0
  ) {
    return { labelKey: 'yokomochi.goInternalFleet', href: '/warehouse/internal-fleet' };
  }
  if (['CARRIER_PENDING', 'SUBCONTRACTING', 'DRIVER_ASSIGNED'].includes(order.status)) {
    return { labelKey: 'yokomochi.checkExternalCarrier', href: '/warehouse/external-carrier' };
  }
  if (order.status === 'AWAITING_VERIFICATION') {
    return { labelKey: 'yokomochi.arrivalVerificationNeeded' };
  }
  return null;
}

const WAREHOUSE_ORDER_GRID =
  'md:grid-cols-[120px_minmax(0,1.4fr)_72px_minmax(150px,1.6fr)_56px_minmax(0,136px)_32px]';
const DEFAULT_ORDER_GRID =
  'md:grid-cols-[120px_minmax(0,1.4fr)_72px_minmax(150px,1.6fr)_56px_32px]';

export function YokomochiOrderAccordion({
  orders,
  mode,
}: {
  orders: Order[];
  mode: 'warehouse' | 'factory' | 'negotiations' | 'history';
}) {
  const router = useRouter();
  const { t, formatDate: formatLocaleDate, statusLabel } = useTranslation();
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
        {t('yokomochi.noRecords')}
      </div>
    );
  }

  const pendingWarehouse = mode === 'warehouse' ? filtered.filter(needsTripCalculation) : [];

  return (
    <div className="space-y-4">
      {pendingWarehouse.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{t('yokomochi.nextStep')}</p>
          <p className="mt-1 text-xs">{t('yokomochi.nextStepHint')}</p>
        </div>
      )}
    <div className="overflow-hidden rounded-xl border bg-white">
      <div
        className={cn(
          'hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase text-muted-foreground md:grid md:items-center md:gap-2',
          mode === 'warehouse' ? WAREHOUSE_ORDER_GRID : DEFAULT_ORDER_GRID
        )}
      >
        <span>{t('yokomochi.order')}</span>
        <span>
          {interpolate(t('factory.productWarehouse'), {
            partner: mode === 'factory' ? t('factory.warehouse') : t('factory.factory'),
          })}
        </span>
        <span>{t('carrier.pallets')}</span>
        <span className="min-w-[150px] whitespace-nowrap">{t('table.status')}</span>
        <span>{t('yokomochi.trips')}</span>
        {mode === 'warehouse' && <span>{t('yokomochi.action')}</span>}
        <span aria-hidden className="sr-only">
          {t('yokomochi.expand')}
        </span>
      </div>

      {filtered.map((order) => {
        const open = expanded === order.id;
        const fr = order.factoryRequest;
        const res = order.factoryResponse;
        const neg = order.factoryNegotiation;
        const calc = res ? calculateTripsFromPallets(res.availablePallets) : null;
        if (!fr) return null;
        const partner = requestPartnerName(fr, mode, t);
        const trips = order.trips ?? [];
        const next = mode === 'warehouse' ? warehouseNextStep(order) : null;

        return (
          <div key={order.id} className="border-b last:border-b-0">
            {/* Mobile layout */}
            <div
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/30 md:hidden',
                open && 'bg-muted/20'
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setExpanded(open ? null : order.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{order.orderNo}</p>
                  <p className="truncate text-sm font-medium">
                    {order.productName ?? order.cargoType ?? t('yokomochi.defaultProduct')} · {partner}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatLocaleDate(order.createdAt)}</p>
                </div>
                {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>
              {mode === 'warehouse' && next && (
                <div className="max-w-[140px] shrink-0">
                  {next.action === 'confirm-trips' ? (
                    <Button
                      size="sm"
                      className="h-8 w-full truncate text-xs"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await confirmOrderTrips(order.id);
                          router.refresh();
                        })
                      }
                    >
                      {t(next.labelKey)}
                    </Button>
                  ) : next.href ? (
                    <Link
                      href={next.href}
                      className="inline-flex h-8 max-w-full items-center truncate rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent"
                    >
                      <Truck className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{t(next.labelKey)}</span>
                    </Link>
                  ) : null}
                </div>
              )}
            </div>

            {/* Desktop grid — columns stay aligned regardless of action text length */}
            <div
              className={cn(
                'hidden px-4 py-3 hover:bg-muted/30 md:grid md:items-center md:gap-2',
                mode === 'warehouse' ? WAREHOUSE_ORDER_GRID : DEFAULT_ORDER_GRID,
                open && 'bg-muted/20'
              )}
            >
              <button
                type="button"
                className="truncate text-left font-mono text-xs"
                onClick={() => setExpanded(open ? null : order.id)}
              >
                {order.orderNo}
              </button>
              <button
                type="button"
                className="min-w-0 truncate text-left"
                onClick={() => setExpanded(open ? null : order.id)}
              >
                <p className="truncate text-sm font-medium">
                  {order.productName ?? order.cargoType ?? t('yokomochi.defaultProduct')} · {partner}
                </p>
                <p className="truncate text-xs text-muted-foreground">{formatLocaleDate(order.createdAt)}</p>
              </button>
              <span className="text-sm tabular-nums">{fr.requestedPallets}</span>
              <span className="min-w-[150px] overflow-hidden">
                <Badge
                  variant="outline"
                  className="whitespace-nowrap text-[10px]"
                  title={statusLabel(order.status)}
                >
                  {statusLabel(order.status)}
                </Badge>
              </span>
              <span className="text-sm font-medium tabular-nums">
                {order.totalTrips || trips.length || '—'}
              </span>
              {mode === 'warehouse' && (
                <div className="min-w-0">
                  {next?.action === 'confirm-trips' ? (
                    <Button
                      size="sm"
                      className="h-8 w-full max-w-full truncate px-2 text-xs"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await confirmOrderTrips(order.id);
                          router.refresh();
                        })
                      }
                    >
                      <span className="truncate">{t(next.labelKey)}</span>
                    </Button>
                  ) : next?.href ? (
                    <Link
                      href={next.href}
                      className="inline-flex h-8 w-full max-w-full items-center truncate rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent"
                      title={t(next.labelKey)}
                    >
                      <Truck className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{t(next.labelKey)}</span>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              )}
              <button
                type="button"
                className="flex justify-end"
                onClick={() => setExpanded(open ? null : order.id)}
                aria-label={open ? t('common.collapse') : t('common.expand')}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {open && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('yokomochi.requested')}</p>
                    <p>
                      {interpolate(t('yokomochi.palletsBoxes'), {
                        pallets: fr.requestedPallets,
                        boxes: fr.requestedBoxes,
                      })}
                    </p>
                    <p className="text-xs">{formatLocaleDate(fr.requestedDate)}</p>
                  </div>
                  {res && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t('yokomochi.factoryResponse')}</p>
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
                      <p className="text-xs text-muted-foreground">{t('yokomochi.trips')}</p>
                      {trips.map((t) => (
                        <p key={t.id} className="text-xs">
                          {t.tripCode}: {t.pallets}p · {t.status}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {neg && (
                  <BusinessDeliveryCalendar
                    requestedDate={fr.requestedDate}
                    requestedBoxes={neg.requestedBoxes}
                    negotiation={neg}
                    schedules={order.deliverySchedules}
                  />
                )}

                {order.negotiationHistory?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {t('factory.negotiationHistory')}
                    </p>
                    <div className="space-y-1">
                      {order.negotiationHistory.map((h, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {formatLocaleDate(h.createdAt)} — {h.action}
                          {h.message ? `: ${h.message}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {mode === 'warehouse' && needsTripCalculation(order) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="mb-2 text-sm font-semibold">{t('factory.step2FleetCalc')}</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {interpolate(t('yokomochi.palletCalc'), {
                        pallets: res?.availablePallets ?? '—',
                        trips: res ? calculateTripsFromPallets(res.availablePallets).totalTrips : '—',
                      })}
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
                      {t('yokomochi.calcTripsContinue')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {mode === 'warehouse' &&
                  ['TRIPS_CALCULATED', 'INTERNAL_SCHEDULING'].includes(order.status) &&
                  trips.length > 0 && (
                    <div className="rounded-lg border bg-white p-4">
                      <p className="mb-2 text-sm font-semibold">{t('factory.step3InternalFleet')}</p>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {interpolate(t('yokomochi.assignDriversHint'), { count: trips.length })}
                      </p>
                      <Link
                        href="/warehouse/internal-fleet"
                        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {t('yokomochi.goInternalFleetBtn')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  )}

                {mode === 'warehouse' &&
                  neg &&
                  ['FULL', 'PARTIAL'].includes(neg.status) &&
                  order.status === 'NEGOTIATING' && (
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
                      {neg.status === 'PARTIAL'
                        ? interpolate(t('negotiation.approvePartial'), {
                            available: neg.availableBoxes,
                            remaining: neg.remainingBoxes,
                          })
                        : interpolate(t('negotiation.approveFull'), { available: neg.availableBoxes })}
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
                      {t('yokomochi.requestAgain')}
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
                      {t('shinwa.reject')}
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
                      {t('delivery.approveArrival')}
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
                      {t('shinwa.reject')}
                    </Button>
                  </div>
                )}

                {order.deliveryForm && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs font-semibold">{t('factory.deliveryFormTitle')}</p>
                    <p className="text-xs">
                      {t('factory.deliveryFormNo')}: {order.deliveryForm.deliveryNo}
                    </p>
                    <p className="text-xs">
                      {t('factory.approvedBy')}: {order.deliveryForm.approvedBy}
                    </p>
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
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requestedBoxes, setRequestedBoxes] = useState(DEFAULT_REQUESTED_BOXES);
  const requestedBoxCount = Number(requestedBoxes) || 0;
  const requestedPallets = wholePalletsFromBoxes(requestedBoxCount);
  const boxesValid = isValidOrderBoxQuantity(requestedBoxCount);
  const palletDisplay = formatPalletsDisplay(requestedBoxCount);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!boxesValid) return;
    const fd = new FormData(e.currentTarget);
    const boxes = Number(fd.get('requestedBoxes'));
    setError(null);
    startTransition(async () => {
      const { createFactoryRequest } = await import('@/app/actions/yokomochi');
      const result = await createFactoryRequest({
        factoryCompanyId: String(fd.get('factoryCompanyId')),
        requestedPallets: wholePalletsFromBoxes(boxes),
        requestedBoxes: boxes,
        requestedDate: String(fd.get('requestedDate')),
        cargoType: String(fd.get('cargoType') || ''),
        productName: String(fd.get('productName') || ''),
        notes: String(fd.get('notes') || ''),
      });
      if (!result.success) {
        setError(result.error ?? t('factory.submitFailed'));
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
        <Label>{t('factory.factory')}</Label>
        <select name="factoryCompanyId" required className="w-full rounded-lg border px-3 py-2 text-sm">
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>{t('factory.productName')}</Label>
        <Input
          name="productName"
          placeholder={t('yokomochi.defaultProduct')}
          defaultValue={t('yokomochi.defaultProduct')}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('form.cargoType')}</Label>
        <Input
          name="cargoType"
          placeholder={t('yokomochi.defaultCargo')}
          defaultValue={t('yokomochi.defaultCargo')}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('form.totalBoxes')}</Label>
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
        {requestedBoxCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {requestedBoxCount} {t('carrier.boxes')} = {palletDisplay}{' '}
            {t('warehouse.palletsLabel')}
          </p>
        )}
        {requestedBoxCount > 0 && !boxesValid && (
          <p className="text-xs text-destructive">{t('warehouse.invalidBoxQuantity')}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{t('carrier.pallets')}</Label>
        {/* Pallets are derived from boxes so arrow-key and stepper changes stay in sync. */}
        <Input name="requestedPallets" type="number" readOnly value={requestedPallets || ''} />
      </div>
      <div className="space-y-2">
        <Label>{t('carrier.requestedDate')}</Label>
        <Input name="requestedDate" type="date" required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>{t('form.notes')}</Label>
        <Input name="notes" placeholder={t('common.optional')} />
      </div>
      {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending || !boxesValid} className="rounded-xl">
          {isPending ? t('factory.sending') : t('factory.sendRequest')}
        </Button>
      </div>
    </form>
  );
}
