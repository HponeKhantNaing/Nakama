'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

const navItems = [
  { href: '/subcontractor/assigned', labelKey: 'nav.assignedOrders' as const },
  { href: '/subcontractor/drivers', labelKey: 'nav.drivers' as const },
];

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  isAvailable: boolean;
};

export function SubcontractorDriversClient({
  drivers,
  trucks,
}: {
  drivers: Driver[];
  trucks: {
    id: string;
    truckNo: string;
    truckType: string;
    maxBoxes: number;
    capacityWeightKg: number;
    capacityVolumeM3: number;
    status: string;
  }[];
}) {
  const { t } = useTranslation();

  function truckLabel(type: string) {
    const key = `truck.${type}` as TranslationKey;
    const translated = t(key);
    return translated === key ? type.replace(/_/g, ' ') : translated;
  }

  return (
    <DashboardShell titleKey="dashboard.subcontractor" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="subcontractor.driversVehicles" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('shinwa.drivers')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.phone}</p>
                  </div>
                  <Badge variant={d.isAvailable ? 'default' : 'secondary'} className="rounded-lg">
                    {d.isAvailable ? t('common.available') : t('common.onTrip')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('shinwa.vehicles')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trucks.map((tr) => (
                <div
                  key={tr.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{tr.truckNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {truckLabel(tr.truckType)} — {tr.capacityWeightKg} kg / {tr.maxBoxes} boxes
                    </p>
                  </div>
                  <Badge
                    variant={tr.status === 'AVAILABLE' ? 'default' : 'secondary'}
                    className="rounded-lg"
                  >
                    {tr.status === 'AVAILABLE' ? t('common.available') : t('common.inUse')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
