import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { confirmDeliveryByCustomer, saveProofOfDelivery } from '@/app/actions/tms';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const confirmation = await prisma.deliveryConfirmation.findUnique({
    where: { token: params.token },
    include: {
      transportRequest: {
        include: {
          customer: true,
          deliveryItems: { include: { product: true } },
        },
      },
    },
  });

  if (!confirmation) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  if (confirmation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 });
  }

  return NextResponse.json({
    requestNo: confirmation.transportRequest.requestNo,
    customer: confirmation.transportRequest.customer?.name ?? confirmation.transportRequest.destination,
    items: confirmation.transportRequest.deliveryItems,
    arrivedAt: confirmation.transportRequest.arrivedAt,
    alreadyConfirmed: !!confirmation.approvedAt,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await req.json();
  const customerIp =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const confirmation = await prisma.deliveryConfirmation.findUnique({
    where: { token: params.token },
  });
  if (!confirmation) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const result = await confirmDeliveryByCustomer(params.token, {
    approvedBy: body.approvedBy ?? 'Customer',
    notes: body.notes,
    customerIp,
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  if (body.signatureUrl || body.photoUrl) {
    await saveProofOfDelivery(confirmation.transportRequestId, {
      signatureUrl: body.signatureUrl,
      photoUrl: body.photoUrl,
      notes: body.notes,
    });
  }

  return NextResponse.json({ success: true });
}
