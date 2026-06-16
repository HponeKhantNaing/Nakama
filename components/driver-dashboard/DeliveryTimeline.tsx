'use client';

import { DeliveryTimeline as SharedTimeline } from '@/components/delivery-management/DeliveryTimeline';

export function DeliveryTimeline({
  status,
  confirmed,
}: {
  status: string;
  confirmed: boolean;
}) {
  return <SharedTimeline status={status} confirmed={confirmed} />;
}

