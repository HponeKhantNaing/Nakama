import { NextRequest, NextResponse } from 'next/server';
import {
  confirmYokomochiArrivalByToken,
  lookupYokomochiArrivalByToken,
} from '@/app/actions/yokomochi';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const lookup = await lookupYokomochiArrivalByToken(params.token);
  if (!lookup) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  if (lookup.qrExpired && !lookup.alreadyConfirmed) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 });
  }

  return NextResponse.json({
    orderNo: lookup.orderNo,
    tripCode: lookup.tripCode,
    tripNo: lookup.tripNo,
    totalTrips: lookup.totalTrips,
    completedTrips: lookup.completedTrips,
    productName: lookup.productName,
    factoryName: lookup.factoryName,
    destination: lookup.destination,
    driver: lookup.driverName,
    truck: lookup.truckLabel,
    cargoType: lookup.cargoType,
    boxes: lookup.boxes,
    pallets: lookup.pallets,
    arrivedAt: lookup.arrivedWarehouseAt?.toISOString() ?? null,
    alreadyConfirmed: lookup.alreadyConfirmed,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await req.json();
  const customerIp =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const result = await confirmYokomochiArrivalByToken(params.token, {
    approvedBy: body.approvedBy ?? 'Warehouse',
    notes: body.notes,
    customerIp,
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
