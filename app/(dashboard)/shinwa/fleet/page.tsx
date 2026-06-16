import { getShinwaFleet } from '@/app/actions/queries';
import { ShinwaFleetClient } from './shinwa-fleet-client';

export default async function ShinwaFleetPage() {
  const { trucks, drivers } = await getShinwaFleet();
  return <ShinwaFleetClient trucks={trucks} drivers={drivers} />;
}
