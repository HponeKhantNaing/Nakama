import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { confirmAssignmentByCustomer } from '@/app/actions/fleet';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const confirmation = await prisma.assignmentConfirmation.findUnique({
    where: { qrToken: params.token },
    include: {
      assignment: {
        include: {
          transportRequest: {
            include: {
              customer: true,
              deliveryItems: { include: { product: true } },
            },
          },
          driver: { select: { name: true, phone: true } },
          truck: { select: { truckNo: true, plateNumber: true } },
        },
      },
    },
  });

  if (!confirmation) {
    const legacy = await prisma.deliveryConfirmation.findUnique({
      where: { token: params.token },
      include: {
        transportRequest: {
          include: {
            customer: true,
            deliveryItems: { include: { product: true } },
            tripAllocation: { include: { driver: true, truck: true } },
          },
        },
      },
    });
    if (!legacy) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    if (legacy.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }
    return NextResponse.json({
      requestNo: legacy.transportRequest.requestNo,
      customer:
        legacy.transportRequest.customer?.name ?? legacy.transportRequest.destination,
      driver: legacy.transportRequest.tripAllocation?.driver?.name,
      truck:
        legacy.transportRequest.tripAllocation?.truck?.truckNo ??
        legacy.transportRequest.tripAllocation?.truck?.plateNumber,
      items: legacy.transportRequest.deliveryItems,
      arrivedAt: legacy.transportRequest.arrivedAt,
      alreadyConfirmed: !!legacy.approvedAt,
    });
  }

  if (confirmation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 });
  }

  const req = confirmation.assignment.transportRequest;
  return NextResponse.json({
    requestNo: req.requestNo,
    customer: req.customer?.name ?? req.destination,
    driver: confirmation.assignment.driver?.name,
    truck:
      confirmation.assignment.truck?.truckNo ?? confirmation.assignment.truck?.plateNumber,
    items: req.deliveryItems,
    arrivedAt: confirmation.assignment.arrivedAt ?? req.arrivedAt,
    alreadyConfirmed: confirmation.approved,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await req.json();
  const customerIp =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const assignmentConfirm = await prisma.assignmentConfirmation.findUnique({
    where: { qrToken: params.token },
  });

  if (assignmentConfirm) {
    const result = await confirmAssignmentByCustomer(params.token, {
      approvedBy: body.approvedBy ?? 'Customer',
      customerIp,
    });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const { confirmDeliveryByCustomer } = await import('@/app/actions/tms');
  const result = await confirmDeliveryByCustomer(params.token, {
    approvedBy: body.approvedBy ?? 'Customer',
    notes: body.notes,
    customerIp,
  });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
