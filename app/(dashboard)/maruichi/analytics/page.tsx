import { getMaruichiAnalytics } from '@/app/actions/queries';
import { MaruichiAnalyticsClient } from './maruichi-analytics-client';

export default async function MaruichiAnalyticsPage() {
  const analytics = await getMaruichiAnalytics();
  return <MaruichiAnalyticsClient analytics={analytics} />;
}
