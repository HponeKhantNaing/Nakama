'use client';

import { useState } from 'react';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { factoryNavItems } from '@/lib/nav/yokomochi';
import { FactoryAvailabilityForm } from '@/components/yokomochi/FactoryAvailabilityForm';
import { NegotiationChatPanel } from '@/components/yokomochi/NegotiationChatPanel';
import { BusinessDeliveryCalendar } from '@/components/yokomochi/BusinessDeliveryCalendar';
import { useTranslation } from '@/lib/i18n/context';

type ChatMessage = {
  id: string;
  message: string;
  createdAt: Date | string;
  sender: { role: string; name: string };
};

export function FactoryNegotiationClient({
  orders,
  chatMessagesByOrder = {},
}: {
  orders: any[];
  chatMessagesByOrder?: Record<string, ChatMessage[]>;
}) {
  const { t } = useTranslation();

  const awaitingFactoryResponse = orders.filter((o) => o.status === 'FACTORY_PENDING');
  const awaitingWarehouseApproval = orders.filter(
    (o) => o.status === 'NEGOTIATING' && o.factoryNegotiation
  );

  const [chatOrderId, setChatOrderId] = useState(awaitingWarehouseApproval[0]?.id ?? '');

  return (
    <DashboardShell titleKey="dashboard.factory" navItems={factoryNavItems}>
      <PageHeader titleKey="nav.negotiations" />
      <div className="space-y-6">
        <FactoryAvailabilityForm
          orders={awaitingFactoryResponse}
          chatMessagesByOrder={chatMessagesByOrder}
        />

        {awaitingWarehouseApproval.length > 0 && (
          <section className="space-y-3 rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold">{t('factory.activeNegotiations')}</p>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm md:max-w-md"
              value={chatOrderId}
              onChange={(e) => setChatOrderId(e.target.value)}
            >
              {awaitingWarehouseApproval.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.factoryNegotiation?.status}
                </option>
              ))}
            </select>
            {(() => {
              const order =
                awaitingWarehouseApproval.find((o) => o.id === chatOrderId) ??
                awaitingWarehouseApproval[0];
              const neg = order?.factoryNegotiation;
              if (!order || !neg) return null;
              return (
                <div className="grid gap-4 lg:grid-cols-2">
                  <BusinessDeliveryCalendar
                    requestedDate={order.factoryRequest.requestedDate}
                    requestedBoxes={neg.requestedBoxes}
                    negotiation={neg}
                    schedules={order.deliverySchedules}
                  />
                  <NegotiationChatPanel
                    orderId={order.id}
                    orderNo={order.orderNo}
                    initialMessages={(chatMessagesByOrder[order.id] ?? []) as any}
                    viewerRole="FACTORY_STAFF"
                  />
                </div>
              );
            })()}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
