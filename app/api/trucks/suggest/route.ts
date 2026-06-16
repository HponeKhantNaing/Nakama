import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { suggestTruckAssignment } from '@/lib/tms/truck-assignment';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { totalWeightKg, totalVolumeM3, totalQuantity } = await req.json();
  if (!totalWeightKg || !totalVolumeM3) {
    return NextResponse.json({ error: 'weight and volume required' }, { status: 400 });
  }

  const plan = suggestTruckAssignment(totalWeightKg, totalVolumeM3, totalQuantity ?? 0);
  return NextResponse.json(plan);
}
