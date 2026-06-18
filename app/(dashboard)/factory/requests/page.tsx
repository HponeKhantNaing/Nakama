import { getFactoryYokomochiOrders, getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import { FactoryRequestsClient } from './factory-requests-client';

export const dynamic = 'force-dynamic';

export default async function FactoryRequestsPage() {
  const [orders, deliveries] = await Promise.all([
    getFactoryYokomochiOrders(),
    getYokomochiDeliveryTracking(),
  ]);
  return <FactoryRequestsClient orders={orders} deliveries={deliveries} />;
}
