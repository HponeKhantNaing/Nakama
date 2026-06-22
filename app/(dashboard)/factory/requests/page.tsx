import { getFactoryYokomochiOrders } from '@/app/actions/yokomochi';
import { FactoryRequestsClient } from './factory-requests-client';

export const dynamic = 'force-dynamic';

export default async function FactoryRequestsPage() {
  const orders = await getFactoryYokomochiOrders();

  return <FactoryRequestsClient orders={orders} />;
}


