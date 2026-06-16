import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const trucks = await prisma.truck.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { truckNumber: 'asc' },
  });

  return NextResponse.json(trucks);
}
