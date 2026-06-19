'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import {
  YokomochiOrderAccordion,
  CreateFactoryRequestForm,
} from '@/components/yokomochi/YokomochiOrderAccordion';
import {
  YokomochiDeliveryTrackingTable,
  type YokomochiDeliveryTrackingRow,
} from '@/components/yokomochi/YokomochiDeliveryTrackingTable';
import { WarehouseArrivalScanner } from '@/components/yokomochi/WarehouseArrivalScanner';
import { useTranslation } from '@/lib/i18n/context';

export function WarehouseFactoryRequestsClient({
  orders,
  factories,
  deliveries,
}: {
  orders: any[];
  factories: { id: string; name: string }[];
  deliveries: YokomochiDeliveryTrackingRow[];
}) {
  const { t } = useTranslation();

  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.factoryRequests" />

        <section className="space-y-3">
          <WarehouseArrivalScanner />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{t('delivery.trackingTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('delivery.trackingDesc')}</p>
          </div>
          <YokomochiDeliveryTrackingTable rows={deliveries} />
        </section>

        <CreateFactoryRequestForm factories={factories} />
        <YokomochiOrderAccordion orders={orders} mode="warehouse" />
      </div>
    </DashboardShell>
  );
}
