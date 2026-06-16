import { getMaruichiHistory } from '@/app/actions/queries';
import { MaruichiHistoryClient } from './maruichi-history-client';

export default async function MaruichiHistoryPage() {
  const requests = await getMaruichiHistory();
  return <MaruichiHistoryClient requests={requests} />;
}
