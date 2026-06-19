import { getFactoryYokomochiOrders, getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import { getNegotiationChatMessages } from '@/app/actions/negotiation-chat';
import { FactoryRequestsClient } from './factory-requests-client';

export const dynamic = 'force-dynamic';

export default async function FactoryRequestsPage() {
  const [orders, deliveries] = await Promise.all([
    getFactoryYokomochiOrders(),
    getYokomochiDeliveryTracking(),
  ]);

  const chatEligible = orders.filter(
    (o) => o.status === 'FACTORY_PENDING' || (o.factoryNegotiation && o.status === 'NEGOTIATING')
  );
  const chatMessagesByOrder: Record<string, Awaited<ReturnType<typeof getNegotiationChatMessages>>> = {};
  for (const o of chatEligible) {
    chatMessagesByOrder[o.id] = await getNegotiationChatMessages(o.id);
  }

  return (
    <FactoryRequestsClient
      orders={orders}
      deliveries={deliveries}
      chatMessagesByOrder={chatMessagesByOrder}
    />
  );
}
