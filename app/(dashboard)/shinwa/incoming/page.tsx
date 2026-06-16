import { getShinwaIncomingOrders, getShinwaFleet, getSubcontractors } from '@/app/actions/queries';
import { ShinwaIncomingClient } from './shinwa-incoming-client';

export default async function ShinwaIncomingPage() {
  const [requests, fleet, subcontractors] = await Promise.all([
    getShinwaIncomingOrders(),
    getShinwaFleet(),
    getSubcontractors(),
  ]);

  return (
    <ShinwaIncomingClient
      requests={requests}
      drivers={fleet.drivers}
      vehicles={fleet.vehicles}
      subcontractors={subcontractors}
    />
  );
}
