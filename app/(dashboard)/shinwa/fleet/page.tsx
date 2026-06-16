import { getShinwaFleet } from '@/app/actions/queries';
import { ShinwaFleetClient } from './shinwa-fleet-client';

export default async function ShinwaFleetPage() {
  const { vehicles, drivers } = await getShinwaFleet();
  return <ShinwaFleetClient vehicles={vehicles} drivers={drivers} />;
}
