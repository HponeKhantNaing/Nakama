import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateDeliveryQr } from '@/app/actions/tms';
import { generateAssignmentQr } from '@/app/actions/fleet';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const assignmentId = req.nextUrl.searchParams.get('assignmentId');
  const result = assignmentId
    ? await generateAssignmentQr(assignmentId)
    : await generateDeliveryQr(params.id);

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL((result.data as { url: string }).url, {
    width: 300,
    margin: 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });

  const payload = result.data as { token: string; url: string };
  return NextResponse.json({ ...payload, qrDataUrl });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const assignmentConfirm = await prisma.assignmentConfirmation.findFirst({
    where: { assignment: { transportRequestId: params.id } },
  });
  if (assignmentConfirm) return NextResponse.json(assignmentConfirm);

  const confirmation = await prisma.deliveryConfirmation.findUnique({
    where: { transportRequestId: params.id },
  });
  if (!confirmation) return NextResponse.json({ error: 'No QR generated' }, { status: 404 });
  return NextResponse.json(confirmation);
}
