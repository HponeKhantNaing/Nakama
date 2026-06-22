import { getFactoryYokomochiOrders } from '@/app/actions/yokomochi';
import { FactoryHistoryClient } from './factory-history-client';

export const dynamic = 'force-dynamic';

export default async function FactoryHistoryPage() {
  const orders = await getFactoryYokomochiOrders();

  return <FactoryHistoryClient orders={orders} />;
}
