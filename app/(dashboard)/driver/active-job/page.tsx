import { getDriverActiveJob, getDriverHistory } from '@/app/actions/queries';
import { DriverActiveJobClient } from './driver-active-job-client';

export default async function DriverActiveJobPage() {
  const [activeJob, history] = await Promise.all([getDriverActiveJob(), getDriverHistory()]);
  return <DriverActiveJobClient activeJob={activeJob} history={history} />;
}
