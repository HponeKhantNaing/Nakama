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
  const [isPending, startTransition] = useTransition();

  const pending = orders.filter((o) => !o.factoryResponse && o.status !== 'CANCELLED');

  function respond(status: 'FULL' | 'PARTIAL' | 'REJECTED') {
    if (!selected) return;
    const order = orders.find((o) => o.id === selected);
    if (!order) return;
    const fd = document.getElementById('factory-response-form') as HTMLFormElement;
    const form = new FormData(fd);
    startTransition(async () => {
      await submitFactoryResponse({
        yokomochiOrderId: selected,
        availableQuantity: Number(form.get('availableQuantity') ?? order.factoryRequest.requestedQuantity),
        availablePallets: Number(form.get('availablePallets') ?? order.factoryRequest.requestedPallets),
        availableBoxes: Number(form.get('availableBoxes') ?? order.factoryRequest.requestedBoxes),
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
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select request</option>
              {pending.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.factoryRequest.requestedPallets} pallets requested
                </option>
              ))}
            </select>
            {selected && (
              <form id="factory-response-form" className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Available Pallets</Label>
                  <Input name="availablePallets" type="number" defaultValue={70} />
                </div>
                <div>
                  <Label>Available Boxes</Label>
                  <Input name="availableBoxes" type="number" defaultValue={350} />
                </div>
                <div>
                  <Label>Available Quantity</Label>
                  <Input name="availableQuantity" type="number" defaultValue={700} />
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
