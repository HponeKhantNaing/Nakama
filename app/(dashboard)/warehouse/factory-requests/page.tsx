import { getWarehouseYokomochiOrders, getFactoryCompanies } from '@/app/actions/yokomochi';
import { WarehouseFactoryRequestsClient } from './warehouse-factory-requests-client';

export default async function WarehouseFactoryRequestsPage() {
  const [orders, factories] = await Promise.all([
    getWarehouseYokomochiOrders(),
    getFactoryCompanies(),
  ]);

  return <WarehouseFactoryRequestsClient orders={orders} factories={factories} />;
}
