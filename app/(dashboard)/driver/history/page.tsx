import { getDriverHistory } from '@/app/actions/queries';
import { DriverHistoryClient } from './driver-history-client';

export default async function DriverHistoryPage() {
  const history = await getDriverHistory();
  return <DriverHistoryClient history={history} />;
}
