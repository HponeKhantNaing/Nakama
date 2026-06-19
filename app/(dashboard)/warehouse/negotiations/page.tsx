import { getWarehouseYokomochiOrders } from '@/app/actions/yokomochi';
import { getNegotiationChatMessages } from '@/app/actions/negotiation-chat';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import { FactoryNegotiationPanel } from '@/components/yokomochi/FactoryNegotiationPanel';

export default async function WarehouseNegotiationsPage() {
  const orders = await getWarehouseYokomochiOrders();

  const chatEligible = orders.filter(
    (o) => o.status === 'FACTORY_PENDING' || (o.factoryNegotiation && o.status === 'NEGOTIATING')
  );
  const chatMessagesByOrder: Record<string, Awaited<ReturnType<typeof getNegotiationChatMessages>>> = {};

  for (const o of chatEligible) {
    chatMessagesByOrder[o.id] = await getNegotiationChatMessages(o.id);
  }

  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.negotiations" />
        <FactoryNegotiationPanel orders={orders as any} chatMessagesByOrder={chatMessagesByOrder} />
      </div>
    </DashboardShell>
  );
}
