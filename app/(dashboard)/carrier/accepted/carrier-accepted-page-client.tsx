'use client';

import { CarrierAcceptedAllocationClient } from '@/components/yokomochi/CarrierAcceptedAllocationClient';
import { YokomochiDeliveryTrackingLive } from '@/components/yokomochi/YokomochiDeliveryTrackingLive';
import type { YokomochiDeliveryTrackingRow } from '@/components/yokomochi/YokomochiDeliveryTrackingTable';
import type { CarrierAcceptedJobGroup } from '@/app/actions/carrier-fleet';
import { TruckType } from '@prisma/client';
import { useTranslation } from '@/lib/i18n/context';

type FleetDriver = { id: string; name: string; isAvailable: boolean };
type FleetTruck = {
  id: string;
  truckNo: string | null;
  truckNumber: string;
  truckType: TruckType;
  status: string;
};

export function CarrierAcceptedPageClient({
  jobGroups,
  drivers,
  trucks,
  deliveries,
}: {
  jobGroups: CarrierAcceptedJobGroup[];
  drivers: FleetDriver[];
  trucks: FleetTruck[];
  deliveries: YokomochiDeliveryTrackingRow[];
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">{t('delivery.trackingTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('delivery.trackingDesc')}</p>
        </div>
        <YokomochiDeliveryTrackingLive initialRows={deliveries} />
      </section>

      <p className="text-sm text-muted-foreground">
        Allocate registered vehicles to accepted jobs. Remaining boxes update as you add trucks and
        delivery times.
      </p>

      <CarrierAcceptedAllocationClient jobGroups={jobGroups} drivers={drivers} trucks={trucks} />
    </div>
  );
}
