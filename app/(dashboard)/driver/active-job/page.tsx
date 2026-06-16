import { getDriverDashboardData } from '@/app/actions/queries';
import { DriverActiveJobClient } from './driver-active-job-client';

export default async function DriverActiveJobPage() {
  const data = await getDriverDashboardData();
  return <DriverActiveJobClient data={data} />;
}
