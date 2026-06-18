'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { factoryNavItems } from '@/lib/nav/yokomochi';
import { YokomochiOrderAccordion } from '@/components/yokomochi/YokomochiOrderAccordion';
import {
  YokomochiDeliveryTrackingTable,
  type YokomochiDeliveryTrackingRow,
} from '@/components/yokomochi/YokomochiDeliveryTrackingTable';
import { useTranslation } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitFactoryResponse } from '@/app/actions/yokomochi';

const BOXES_PER_PALLET = 16;

function calculatePalletsFromBoxes(boxes: number) {
  return Math.ceil(Math.max(0, boxes) / BOXES_PER_PALLET);
}

function isPositiveIntegerInput(value: string) {
  return value === '' || /^[1-9]\d*$/.test(value);
}

export function FactoryRequestsClient({
  orders,
  deliveries,
}: {
  orders: any[];
  deliveries: YokomochiDeliveryTrackingRow[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const [availableBoxes, setAvailableBoxes] = useState('');
  const [isPending, startTransition] = useTransition();

  const pending = orders.filter((o) => !o.factoryResponse && o.status !== 'CANCELLED');
  const selectedOrder = orders.find((o) => o.id === selected);
  const availableBoxCount = Number(availableBoxes) || 0;
  const availablePallets = calculatePalletsFromBoxes(availableBoxCount);

  function respond(status: 'FULL' | 'PARTIAL' | 'REJECTED') {
    if (!selectedOrder) return;
    const fd = document.getElementById('factory-response-form') as HTMLFormElement;
    if (!fd.reportValidity()) return;
    const form = new FormData(fd);
    const submittedBoxes = Number(form.get('availableBoxes') ?? selectedOrder.factoryRequest.requestedBoxes);
    startTransition(async () => {
      await submitFactoryResponse({
        yokomochiOrderId: selected,
        // Quantity remains for the existing schema, but boxes are the factory response source of truth.
        availableQuantity: submittedBoxes,
        availablePallets: calculatePalletsFromBoxes(submittedBoxes),
        availableBoxes: submittedBoxes,
        availableDate: String(form.get('availableDate')),
        negotiationStatus: status,
        notes: String(form.get('notes') ?? ''),
      });
      router.refresh();
    });
  }

  return (
    <DashboardShell titleKey="dashboard.factory" navItems={factoryNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.factoryRequests" />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{t('delivery.trackingTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('delivery.trackingDesc')}</p>
          </div>
          <YokomochiDeliveryTrackingTable rows={deliveries} />
        </section>

        {pending.length > 0 && (
          <div className="rounded-xl border bg-white p-4">
            <p className="mb-3 text-sm font-semibold">Respond to Warehouse Request</p>
            <select
              className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => {
                const order = orders.find((o) => o.id === e.target.value);
                setSelected(e.target.value);
                setAvailableBoxes(order ? String(order.factoryRequest.requestedBoxes) : '');
              }}
            >
              <option value="">Select request</option>
              {pending.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.factoryRequest.requestedPallets} pallets requested
                </option>
              ))}
            </select>
            {selectedOrder && (
              <form key={selected} id="factory-response-form" className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Available Pallets</Label>
                  {/* Pallets follow available boxes so typing and number-stepper changes stay synced. */}
                  <Input
                    name="availablePallets"
                    type="number"
                    readOnly
                    value={availablePallets}
                  />
                </div>
                <div>
                  <Label>Available Boxes</Label>
                  <Input
                    name="availableBoxes"
                    type="number"
                    min={1}
                    required
                    value={availableBoxes}
                    onChange={(event) => {
                      if (isPositiveIntegerInput(event.target.value)) {
                        setAvailableBoxes(event.target.value);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Available Date</Label>
                  <Input name="availableDate" type="date" required />
                </div>
                <div className="md:col-span-2">
                  <Label>Notes</Label>
                  <Input name="notes" placeholder="e.g. Only 70 pallets available" />
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button type="button" disabled={isPending} onClick={() => respond('FULL')}>
                    FULL
                  </Button>
                  <Button type="button" variant="secondary" disabled={isPending} onClick={() => respond('PARTIAL')}>
                    PARTIAL
                  </Button>
                  <Button type="button" variant="destructive" disabled={isPending} onClick={() => respond('REJECTED')}>
                    REJECTED
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        <YokomochiOrderAccordion orders={orders} mode="factory" />
      </div>
    </DashboardShell>
  );
}
