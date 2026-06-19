'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { handleNegotiation } from '@/app/actions/yokomochi';
import { BusinessDeliveryCalendar } from '@/components/yokomochi/BusinessDeliveryCalendar';
import { NegotiationChatPanel } from '@/components/yokomochi/NegotiationChatPanel';
import { formatDate } from '@/lib/utils';

type Order = {
  id: string;
  orderNo: string;
  status: string;
  factoryRequest: {
    requestedBoxes: number;
    requestedDate: Date | string;
    factoryCompany: { name: string };
  };
  factoryNegotiation?: {
    requestedBoxes: number;
    availableBoxes: number;
    remainingBoxes: number;
    availableDate: Date | string;
    nextAvailableDate: Date | string | null;
    status: string;
    notes: string | null;
  } | null;
  deliverySchedules?: {
    id: string;
    scheduleNo: number;
    deliveryDate: Date | string;
    boxes: number;
    pallets: number;
    totalTrips: number;
    status: string;
  }[];
};

export function FactoryNegotiationPanel({
  orders,
  chatMessagesByOrder,
}: {
  orders: Order[];
  chatMessagesByOrder: Record<string, unknown[]>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const chatEligible = orders.filter(
    (o) => o.status === 'FACTORY_PENDING' || (o.factoryNegotiation && o.status === 'NEGOTIATING')
  );
  const negotiating = orders.filter((o) => o.factoryNegotiation && o.status === 'NEGOTIATING');

  const [selectedId, setSelectedId] = useState(chatEligible[0]?.id ?? '');
  const selected = chatEligible.find((o) => o.id === selectedId) ?? chatEligible[0];
  const neg = selected?.factoryNegotiation;
  const awaitingFactoryResponse = selected?.status === 'FACTORY_PENDING';
  const isRenegotiation = awaitingFactoryResponse && !!neg;

  if (chatEligible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No active factory negotiations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <select
        className="w-full rounded-lg border px-3 py-2 text-sm md:max-w-md"
        value={selected?.id ?? ''}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {chatEligible.map((o) => (
          <option key={o.id} value={o.id}>
            {o.orderNo} —{' '}
            {o.status === 'FACTORY_PENDING' && o.factoryNegotiation
              ? 'Renegotiation'
              : o.factoryNegotiation?.status ?? 'Awaiting factory'}
          </option>
        ))}
      </select>

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          {awaitingFactoryResponse ? (
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {isRenegotiation ? 'Renegotiation — waiting for factory' : 'Waiting for factory'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Request: {selected.factoryRequest.requestedBoxes} boxes · Need{' '}
                  {formatDate(selected.factoryRequest.requestedDate)}
                </p>
                {isRenegotiation && neg && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <p className="font-medium text-foreground">Previous factory offer (superseded)</p>
                    <p>
                      {neg.availableBoxes} boxes · {formatDate(neg.availableDate)}
                      {neg.remainingBoxes > 0 &&
                        ` · ${neg.remainingBoxes} remaining on ${neg.nextAvailableDate ? formatDate(neg.nextAvailableDate) : '—'}`}
                    </p>
                  </div>
                )}
                <p>
                  Factory must reply in chat and submit a{' '}
                  {isRenegotiation ? 'revised' : 'new'} availability (boxes / dates).
                </p>
              </CardContent>
            </Card>
          ) : (
            neg && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{selected.orderNo}</p>
                      <CardTitle className="text-lg">{selected.factoryRequest.factoryCompany.name}</CardTitle>
                    </div>
                    <Badge>{neg.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Request</p>
                      <p className="text-xl font-bold">{neg.requestedBoxes} boxes</p>
                      <p className="text-xs">Need: {formatDate(selected.factoryRequest.requestedDate)}</p>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">Factory Reply</p>
                      <p className="text-xl font-bold">{neg.availableBoxes} boxes</p>
                      <p className="text-xs">{formatDate(neg.availableDate)}</p>
                    </div>
                    {neg.remainingBoxes > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                        <p className="text-xs text-amber-800">Remaining</p>
                        <p className="text-xl font-bold text-amber-900">{neg.remainingBoxes} boxes</p>
                        {neg.nextAvailableDate && (
                          <p className="text-xs text-amber-800">{formatDate(neg.nextAvailableDate)}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {neg.notes && <p className="text-xs text-muted-foreground">Note: {neg.notes}</p>}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({ yokomochiOrderId: selected.id, action: 'APPROVE' });
                          router.refresh();
                        })
                      }
                    >
                      {neg.status === 'PARTIAL'
                        ? `Approve partial (${neg.availableBoxes} + ${neg.remainingBoxes} boxes)`
                        : `Approve full (${neg.availableBoxes} boxes)`}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({
                            yokomochiOrderId: selected.id,
                            action: 'REQUEST_AGAIN',
                            message: 'Please reconsider delivery dates',
                          });
                          router.refresh();
                        })
                      }
                    >
                      Negotiate
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await handleNegotiation({ yokomochiOrderId: selected.id, action: 'REJECT' });
                          router.refresh();
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {neg && !awaitingFactoryResponse && (
            <BusinessDeliveryCalendar
              requestedDate={selected.factoryRequest.requestedDate}
              requestedBoxes={neg.requestedBoxes}
              negotiation={neg}
              schedules={selected.deliverySchedules}
            />
          )}

          <div className={neg && !awaitingFactoryResponse ? 'lg:col-span-2' : 'lg:col-span-2'}>
            <NegotiationChatPanel
              orderId={selected.id}
              orderNo={selected.orderNo}
              initialMessages={(chatMessagesByOrder[selected.id] ?? []) as any}
              viewerRole="MARUICHI_STAFF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
