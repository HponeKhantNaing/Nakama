import prisma from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { requireRole } from '@/lib/session';
import { ShinwaSubcontractClient } from './shinwa-subcontract-client';

export default async function ShinwaSubcontractPage() {
  await requireRole(['SHINWA_STAFF']);

  const requests = await prisma.transportRequest.findMany({
    where: {
      status: OrderStatus.SUBCONTRACTED,
      subContractAssignment: { isNot: null },
    },
    include: {
      creatorCompany: { select: { id: true, name: true } },
      handlerCompany: { select: { id: true, name: true } },
      tripAllocation: {
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        },
      },
      subContractAssignment: {
        include: { subcontractor: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return <ShinwaSubcontractClient requests={requests} />;
}
