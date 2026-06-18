import { getDriverYokomochiHistory } from '@/app/actions/yokomochi';
import { DriverHistoryClient } from './driver-history-client';

export const dynamic = 'force-dynamic';

export default async function DriverHistoryPage() {
  const history = await getDriverYokomochiHistory();
  return <DriverHistoryClient history={history as any} />;
}
