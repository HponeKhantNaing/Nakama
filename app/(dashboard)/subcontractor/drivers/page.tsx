import { getSubcontractorFleet } from '@/app/actions/queries';
import { SubcontractorDriversClient } from './subcontractor-drivers-client';

export default async function SubcontractorDriversPage() {
  const { drivers, vehicles } = await getSubcontractorFleet();
  return <SubcontractorDriversClient drivers={drivers} vehicles={vehicles} />;
}
