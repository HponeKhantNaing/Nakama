import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

const requestInclude = {
  creatorCompany: { select: { id: true, name: true } },
  handlerCompany: { select: { id: true, name: true } },
  tripAllocation: {
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
    },
  },
  subContractAssignment: {
    include: {
      subcontractor: { select: { id: true, name: true } },
    },
  },
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as OrderStatus | null;

  const where: Record<string, unknown> = {};

  switch (session.user.role) {
    case 'MARUICHI_STAFF':
      where.creatorCompanyId = session.user.companyId;
      break;
    case 'SHINWA_STAFF':
      where.handlerCompanyId = session.user.companyId;
      break;
    case 'SUBCONTRACTOR_STAFF':
      where.subContractAssignment = { subcontractorId: session.user.companyId };
      break;
    case 'DRIVER': {
      const driver = await prisma.driver.findFirst({
        where: { userId: session.user.id },
      });
      if (!driver) return NextResponse.json([]);
      where.tripAllocation = { driverId: driver.id };
      break;
    }
  }

  if (status) {
    where.status = status;
  }

  const requests = await prisma.transportRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(requests);
}
