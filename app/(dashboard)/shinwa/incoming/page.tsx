import { getShinwaDeliveryBoard, getShinwaFleet, getSubcontractors } from '@/app/actions/queries';
import { ShinwaIncomingClient } from './shinwa-incoming-client';

export default async function ShinwaIncomingPage({
  searchParams,
}: {
  searchParams: { filter?: string; search?: string; page?: string; pageSize?: string };
}) {
  const filter = (searchParams.filter as any) ?? 'active';
  const search = searchParams.search ?? '';
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const pageSize = searchParams.pageSize ? Number(searchParams.pageSize) : 50;

  const [board, fleet, subcontractors] = await Promise.all([
    getShinwaDeliveryBoard({ filter, search, page, pageSize }),
    getShinwaFleet(),
    getSubcontractors(),
  ]);

  return (
    <ShinwaIncomingClient
      board={board}
      drivers={fleet.drivers}
      trucks={fleet.trucks}
      subcontractors={subcontractors}
    />
  );
}
