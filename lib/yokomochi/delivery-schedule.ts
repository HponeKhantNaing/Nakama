import type { Prisma } from '@prisma/client';
import {
  calculateTripsFromPallets,
  palletsForTrip,
} from '@/lib/yokomochi/trip-calculation';
import { DeliveryScheduleStatus, YokomochiOrderStatus, YokomochiTripStatus } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export function calculatePalletsFromBoxes(boxes: number) {
  return Math.ceil(Math.max(0, boxes) / 16);
}

export type ScheduleInput = {
  scheduleNo: number;
  deliveryDate: Date;
  boxes: number;
  pallets: number;
};

/** Build delivery schedule rows from a factory negotiation outcome. */
export function buildDeliverySchedulesFromNegotiation(input: {
  requestedBoxes: number;
  availableBoxes: number;
  remainingBoxes: number;
  availableDate: Date;
  nextAvailableDate: Date | null;
  status: 'FULL' | 'PARTIAL' | 'REJECTED';
}): ScheduleInput[] {
  if (input.status === 'REJECTED') return [];

  if (input.status === 'FULL') {
    return [
      {
        scheduleNo: 1,
        deliveryDate: input.availableDate,
        boxes: input.availableBoxes,
        pallets: calculatePalletsFromBoxes(input.availableBoxes),
      },
    ];
  }

  // PARTIAL — never lose remainder
  const remainder = input.remainingBoxes > 0 ? input.remainingBoxes : input.requestedBoxes - input.availableBoxes;
  const schedules: ScheduleInput[] = [
    {
      scheduleNo: 1,
      deliveryDate: input.availableDate,
      boxes: input.availableBoxes,
      pallets: calculatePalletsFromBoxes(input.availableBoxes),
    },
  ];

  if (remainder > 0 && input.nextAvailableDate) {
    schedules.push({
      scheduleNo: 2,
      deliveryDate: input.nextAvailableDate,
      boxes: remainder,
      pallets: calculatePalletsFromBoxes(remainder),
    });
  }

  return schedules;
}

/** Persist schedules and generate PLANNED trips per schedule date. */
export async function createDeliverySchedulesWithTrips(
  tx: Tx,
  params: {
    factoryRequestId: string;
    yokomochiOrderId: string;
    orderNo: string;
    schedules: ScheduleInput[];
  }
) {
  let globalTripNo = (await tx.yokomochiTrip.count({ where: { yokomochiOrderId: params.yokomochiOrderId } })) + 1;
  let orderTotalTrips = 0;

  for (const s of params.schedules) {
    const calc = calculateTripsFromPallets(s.pallets);

    const schedule = await tx.deliverySchedule.create({
      data: {
        factoryRequestId: params.factoryRequestId,
        yokomochiOrderId: params.yokomochiOrderId,
        scheduleNo: s.scheduleNo,
        deliveryDate: s.deliveryDate,
        boxes: s.boxes,
        pallets: s.pallets,
        totalTrips: calc.totalTrips,
        status: DeliveryScheduleStatus.TRIPS_CALCULATED,
      },
    });

    for (let i = 1; i <= calc.totalTrips; i++) {
      const pallets = palletsForTrip(i, s.pallets);
      await tx.yokomochiTrip.create({
        data: {
          yokomochiOrderId: params.yokomochiOrderId,
          deliveryScheduleId: schedule.id,
          scheduledDate: s.deliveryDate,
          tripNo: globalTripNo,
          tripCode: `${params.orderNo}-S${s.scheduleNo}-T${i}`,
          pallets,
          boxes: Math.round((s.boxes / s.pallets) * pallets) || 0,
          status: YokomochiTripStatus.PLANNED,
        },
      });
      globalTripNo += 1;
    }

    orderTotalTrips += calc.totalTrips;
  }

  await tx.yokomochiOrder.update({
    where: { id: params.yokomochiOrderId },
    data: {
      status: YokomochiOrderStatus.TRIPS_CALCULATED,
      totalTrips: orderTotalTrips,
    },
  });

  return orderTotalTrips;
}
