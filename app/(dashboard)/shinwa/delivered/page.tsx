import { getShinwaDeliveryBoard, getShinwaFleet, getSubcontractors } from '@/app/actions/queries';
import { ShinwaDeliveredClient } from './shinwa-delivered-client';

export default async function ShinwaDeliveredPage({
  searchParams,
}: {
  searchParams: { filter?: string; search?: string; page?: string; pageSize?: string };
}) {
  const search = searchParams.search ?? '';
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const pageSize = searchParams.pageSize ? Number(searchParams.pageSize) : 50;

  const [board, fleet, subcontractors] = await Promise.all([
    getShinwaDeliveryBoard({ filter: 'completed', search, page, pageSize }),
    getShinwaFleet(),
    getSubcontractors(),
  ]);

  return (
    <ShinwaDeliveredClient
      board={board}
      drivers={fleet.drivers}
      trucks={fleet.trucks}
      subcontractors={subcontractors}
    />
  );
}
