import { getMaruichiRequests } from '@/app/actions/queries';
import { MaruichiPageClient } from './maruichi-page-client';

export default async function MaruichiPage() {
  const requests = await getMaruichiRequests();
  return <MaruichiPageClient requests={requests} />;
}
