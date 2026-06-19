'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitFactoryResponse } from '@/app/actions/yokomochi';
import { NegotiationChatPanel } from '@/components/yokomochi/NegotiationChatPanel';
import {
  factoryChatAllowsSubmit,
  lastRenegotiationAt,
} from '@/lib/yokomochi/negotiation-chat-gate';
import { toLocalDateString } from '@/lib/yokomochi/dates';

const BOXES_PER_PALLET = 16;

function calculatePalletsFromBoxes(boxes: number) {
  return Math.ceil(Math.max(0, boxes) / BOXES_PER_PALLET);
}

function isPositiveIntegerInput(value: string) {
  return value === '' || /^[1-9]\d*$/.test(value);
}

type Order = {
  id: string;
  orderNo: string;
  factoryRequest: { requestedBoxes: number; requestedDate: Date | string };
  factoryNegotiation?: {
    availableBoxes: number;
    availableDate: Date | string;
    nextAvailableDate: Date | string | null;
    notes: string | null;
  } | null;
  negotiationHistory?: { action: string; createdAt: Date | string }[];
};

type ChatMessage = {
  id: string;
  message: string;
  createdAt: Date | string;
  sender: { role: string; name: string };
};

export function FactoryAvailabilityForm({
  orders,
  chatMessagesByOrder,
}: {
  orders: Order[];
  chatMessagesByOrder: Record<string, ChatMessage[]>;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? '');
  const [availableBoxes, setAvailableBoxes] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [nextAvailableDate, setNextAvailableDate] = useState('');
  const [factoryChatReady, setFactoryChatReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedOrder = orders.find((o) => o.id === selectedId);
  const isRenegotiation = !!selectedOrder?.factoryNegotiation;
  const renegotiationAt = selectedOrder ? lastRenegotiationAt(selectedOrder.negotiationHistory) : null;
  const availableBoxCount = Number(availableBoxes) || 0;
  const availablePallets = calculatePalletsFromBoxes(availableBoxCount);
  const requestedBoxes = selectedOrder?.factoryRequest.requestedBoxes ?? 0;
  const isPartialOffer =
    availableBoxCount > 0 && availableBoxCount < requestedBoxes;
  const remainingBoxes = Math.max(0, requestedBoxes - availableBoxCount);

  function loadOrderForm(order: Order) {
    const neg = order.factoryNegotiation;
    const msgs = chatMessagesByOrder[order.id] ?? [];
    const renegAt = lastRenegotiationAt(order.negotiationHistory);

    if (neg) {
      setAvailableBoxes(String(neg.availableBoxes));
      setAvailableDate(toLocalDateString(neg.availableDate));
      setNextAvailableDate(neg.nextAvailableDate ? toLocalDateString(neg.nextAvailableDate) : '');
    } else {
      setAvailableBoxes(String(order.factoryRequest.requestedBoxes));
      setAvailableDate(toLocalDateString(order.factoryRequest.requestedDate));
      setNextAvailableDate('');
    }

    setFactoryChatReady(factoryChatAllowsSubmit(msgs, renegAt));
  }

  useEffect(() => {
    if (selectedOrder) loadOrderForm(selectedOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function submitOffer() {
    if (!selectedOrder) return;
    const status: 'FULL' | 'PARTIAL' = isPartialOffer ? 'PARTIAL' : 'FULL';
    respond(status);
  }

  function respond(status: 'FULL' | 'PARTIAL' | 'REJECTED') {
    if (!selectedOrder) return;
    if (!factoryChatReady) {
      alert(
        isRenegotiation
          ? 'Reply in chat about the revised request before updating availability.'
          : 'Reply in the negotiation chat before submitting availability to the warehouse.'
      );
      return;
    }
    if (status === 'PARTIAL' && !nextAvailableDate) {
      alert('Next available date is required for partial delivery');
      return;
    }
    if (!availableDate) {
      alert('Available date is required');
      return;
    }

    startTransition(async () => {
      const result = await submitFactoryResponse({
        yokomochiOrderId: selectedOrder.id,
        availableQuantity: availableBoxCount || selectedOrder.factoryRequest.requestedBoxes,
        availablePallets: calculatePalletsFromBoxes(availableBoxCount || selectedOrder.factoryRequest.requestedBoxes),
        availableBoxes: availableBoxCount || selectedOrder.factoryRequest.requestedBoxes,
        availableDate,
        nextAvailableDate: status === 'PARTIAL' ? nextAvailableDate : undefined,
        negotiationStatus: status,
        notes: '',
      });
      if (result && 'success' in result && !result.success) {
        alert(result.error ?? 'Failed to submit response');
        return;
      }
      router.refresh();
    });
  }

  if (orders.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <p className="text-sm font-semibold">
          {isRenegotiation ? 'Revise availability (warehouse renegotiation)' : 'Step 1 — Negotiate with warehouse'}
        </p>
        <p className="text-xs text-muted-foreground">
          Chat first, then submit updated boxes and dates.{' '}
          {isRenegotiation
            ? 'Warehouse asked for changes — send a new chat reply, then update your formal offer below.'
            : 'Formal availability is locked until you send at least one chat message.'}
        </p>
      </div>

      <select
        className="w-full rounded-lg border px-3 py-2 text-sm md:max-w-md"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            {o.orderNo} — {o.factoryRequest.requestedBoxes} boxes
            {o.factoryNegotiation ? ' (renegotiation)' : ''}
          </option>
        ))}
      </select>

      {selectedOrder && (
        <div className="grid gap-4 lg:grid-cols-2">
          <NegotiationChatPanel
            orderId={selectedOrder.id}
            orderNo={selectedOrder.orderNo}
            initialMessages={(chatMessagesByOrder[selectedOrder.id] ?? []) as any}
            viewerRole="FACTORY_STAFF"
            onMessagesChange={(msgs) =>
              setFactoryChatReady(factoryChatAllowsSubmit(msgs, renegotiationAt))
            }
          />

          <div className="space-y-3">
            <p className="text-sm font-semibold">
              {isRenegotiation ? 'Update formal offer to warehouse' : 'Step 2 — Submit availability to warehouse'}
            </p>
            {isRenegotiation && selectedOrder.factoryNegotiation && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Previous offer: {selectedOrder.factoryNegotiation.availableBoxes} boxes on{' '}
                {toLocalDateString(selectedOrder.factoryNegotiation.availableDate)}
                {selectedOrder.factoryNegotiation.nextAvailableDate &&
                  ` · remainder on ${toLocalDateString(selectedOrder.factoryNegotiation.nextAvailableDate)}`}
              </p>
            )}
            {!factoryChatReady && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {isRenegotiation
                  ? 'Send a chat reply about the revised request first, then update boxes and dates below.'
                  : 'Send a chat message first, then submit boxes and dates below.'}
              </p>
            )}

            <div className="grid gap-3">
              <div>
                <Label>Available Pallets</Label>
                <Input type="number" readOnly value={availablePallets} />
              </div>
              <div>
                <Label>Available Boxes</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  disabled={!factoryChatReady}
                  value={availableBoxes}
                  onChange={(e) => {
                    if (isPositiveIntegerInput(e.target.value)) setAvailableBoxes(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label>Available Date</Label>
                <Input
                  type="date"
                  required
                  disabled={!factoryChatReady}
                  value={availableDate}
                  onChange={(e) => setAvailableDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Next delivery date (only if boxes &lt; requested)</Label>
                <Input
                  type="date"
                  value={nextAvailableDate}
                  disabled={!factoryChatReady || !isPartialOffer}
                  onChange={(e) => setNextAvailableDate(e.target.value)}
                />
              </div>

              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isPartialOffer
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-primary/20 bg-primary/5 text-primary'
                }`}
              >
                {isPartialOffer ? (
                  <>
                    <p className="font-semibold">Partial delivery (auto-detected)</p>
                    <p>
                      {availableBoxCount} boxes on {availableDate || '—'} · {remainingBoxes} boxes remaining
                      {nextAvailableDate ? ` on ${nextAvailableDate}` : ' — set next date above'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Full delivery (auto-detected)</p>
                    <p>
                      All {availableBoxCount || requestedBoxes} boxes on {availableDate || '—'}
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isPending || !factoryChatReady || !availableDate || (isPartialOffer && !nextAvailableDate)}
                  onClick={submitOffer}
                >
                  Submit offer to warehouse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || !factoryChatReady}
                  onClick={() => respond('REJECTED')}
                >
                  Cannot fulfill
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
