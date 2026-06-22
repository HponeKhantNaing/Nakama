import { getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import { FactoryTrackingClient } from './factory-tracking-client';

export const dynamic = 'force-dynamic';

export default async function FactoryTrackingPage() {
  const deliveries = await getYokomochiDeliveryTracking();

  return <FactoryTrackingClient deliveries={deliveries} />;
}
