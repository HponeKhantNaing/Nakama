import { getSubcontractorOrders, getSubcontractorFleet } from '@/app/actions/queries';
import { SubcontractorAssignedClient } from './subcontractor-assigned-client';

export default async function SubcontractorAssignedPage() {
  const [requests, fleet] = await Promise.all([
    getSubcontractorOrders(),
    getSubcontractorFleet(),
  ]);

  return (
    <SubcontractorAssignedClient
      requests={requests}
      drivers={fleet.drivers}
      vehicles={fleet.vehicles}
    />
  );
}
