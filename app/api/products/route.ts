import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { suggestTruckAssignment } from '@/lib/tms/truck-assignment';
import { z } from 'zod';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const schema = z.object({
    sku: z.string(),
    name: z.string(),
    unitWeight: z.number().positive(),
    unitVolume: z.number().positive(),
    category: z.string().optional(),
    fragile: z.boolean().optional(),
    temperatureControlled: z.boolean().optional(),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      companyId: session.user.companyId,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
