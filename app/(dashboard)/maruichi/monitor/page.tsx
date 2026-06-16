import { getActiveFleetMonitor } from '@/app/actions/queries';
import { MaruichiMonitorClient } from './maruichi-monitor-client';

export default async function MaruichiMonitorPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter =
    searchParams.filter === 'today' || searchParams.filter === 'delivered'
      ? searchParams.filter
      : 'in_transit';

  const deliveries = await getActiveFleetMonitor(filter);
  return <MaruichiMonitorClient deliveries={deliveries} filter={filter} />;
}
