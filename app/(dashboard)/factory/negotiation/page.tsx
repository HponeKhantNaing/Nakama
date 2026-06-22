import { getFactoryYokomochiOrders } from '@/app/actions/yokomochi';
import { getNegotiationChatMessages } from '@/app/actions/negotiation-chat';
import { FactoryNegotiationClient } from './factory-negotiation-client';

export const dynamic = 'force-dynamic';

export default async function FactoryNegotiationPage() {
  const orders = await getFactoryYokomochiOrders();

  const chatEligible = orders.filter(
    (o) => o.status === 'FACTORY_PENDING' || (o.factoryNegotiation && o.status === 'NEGOTIATING')
  );

  const chatMessagesByOrder: Record<string, Awaited<ReturnType<typeof getNegotiationChatMessages>>> = {};

  for (const o of chatEligible) {
    chatMessagesByOrder[o.id] = await getNegotiationChatMessages(o.id);
  }

  return (
    <FactoryNegotiationClient
      orders={orders}
      chatMessagesByOrder={chatMessagesByOrder}
    />
  );
}
