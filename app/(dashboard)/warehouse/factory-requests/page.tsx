import { getWarehouseYokomochiOrders, getFactoryCompanies, getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import { WarehouseFactoryRequestsClient } from './warehouse-factory-requests-client';

export const dynamic = 'force-dynamic';

export default async function WarehouseFactoryRequestsPage() {
  const [orders, factories, deliveries] = await Promise.all([
    getWarehouseYokomochiOrders(),
    getFactoryCompanies(),
    getYokomochiDeliveryTracking(),
  ]);

  return (
    <WarehouseFactoryRequestsClient
      orders={orders}
      factories={factories}
      deliveries={deliveries}
    />
  );
}
