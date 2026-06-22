'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { warehouseNavItems } from '@/lib/nav/yokomochi';
import {
  YokomochiOrderAccordion,
  CreateFactoryRequestForm,
} from '@/components/yokomochi/YokomochiOrderAccordion';
import { YokomochiDeliveryTrackingLive } from '@/components/yokomochi/YokomochiDeliveryTrackingLive';
import type { YokomochiDeliveryTrackingRow } from '@/components/yokomochi/YokomochiDeliveryTrackingTable';
import { WarehouseArrivalScanner } from '@/components/yokomochi/WarehouseArrivalScanner';
import { useCallback, useState } from 'react';
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
  const [trackingKey, setTrackingKey] = useState(0);
  const handleVerified = useCallback(() => setTrackingKey((k) => k + 1), []);

  return (
    <DashboardShell titleKey="dashboard.warehouse" navItems={warehouseNavItems}>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader titleKey="nav.factoryRequests" />

        <section className="sticky top-14 z-30 -mx-1 rounded-2xl bg-background/95 px-1 py-1 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <WarehouseArrivalScanner onVerified={handleVerified} />
        </section>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold">{t('delivery.trackingTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('delivery.trackingDesc')}</p>
          </div>
          <YokomochiDeliveryTrackingLive
            key={trackingKey}
            initialRows={deliveries}
            refreshNonce={trackingKey}
          />
        </section>

        <details className="group rounded-xl border bg-white open:shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none sm:px-5">
            <span className="flex items-center justify-between gap-2">
              {t('factory.sendRequest')}
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                {t('common.tapToExpand')}
              </span>
            </span>
          </summary>
          <div className="border-t px-2 pb-2 pt-1 sm:px-3">
            <CreateFactoryRequestForm factories={factories} />
          </div>
        </details>

        <YokomochiOrderAccordion orders={orders} mode="warehouse" />
      </div>
    </DashboardShell>
  );
}
