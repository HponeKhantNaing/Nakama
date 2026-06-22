'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { factoryNavItems } from '@/lib/nav/yokomochi';
import {
  YokomochiDeliveryTrackingLive,
} from '@/components/yokomochi/YokomochiDeliveryTrackingLive';
import type { YokomochiDeliveryTrackingRow } from '@/components/yokomochi/YokomochiDeliveryTrackingTable';
import { useTranslation } from '@/lib/i18n/context';

export function FactoryTrackingClient({
  deliveries,
}: {
  deliveries: YokomochiDeliveryTrackingRow[];
}) {
  const { t } = useTranslation();

  return (
    <DashboardShell titleKey="dashboard.factory" navItems={factoryNavItems}>
      <div className="space-y-6">
        <PageHeader titleKey="nav.deliveryTracking" />
        <div>
          <h2 className="text-sm font-semibold">{t('delivery.trackingTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('delivery.trackingDesc')}</p>
        </div>
        <YokomochiDeliveryTrackingLive initialRows={deliveries} />
      </div>
    </DashboardShell>
  );
}
