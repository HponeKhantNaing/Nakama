'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

import { shinwaNavItems } from '@/lib/nav/shinwa';

const navItems = shinwaNavItems;

type Truck = {
  id: string;
  truckNo: string | null;
  truckNumber: string;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
  plateNumber: string;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  isAvailable: boolean;
  user?: { email: string } | null;
};

export function ShinwaFleetClient({
  trucks,
  drivers,
}: {
  trucks: Truck[];
  drivers: Driver[];
}) {
  const { t } = useTranslation();

  function truckLabel(type: string) {
    const key = `truck.${type}` as TranslationKey;
    const translated = t(key);
    return translated === key ? type.replace(/_/g, ' ') : translated;
  }

  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="shinwa.fleetManagement" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('shinwa.availableTrucks')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trucks.map((tr) => (
                <div
                  key={tr.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{tr.truckNo ?? tr.truckNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {truckLabel(tr.truckType)} — {tr.capacityWeightKg} kg / {tr.maxBoxes} boxes
                    </p>
                  </div>
                  <Badge
                    className="rounded-lg"
                    variant={tr.status === 'AVAILABLE' ? 'default' : 'secondary'}
                  >
                    {tr.status === 'AVAILABLE' ? t('common.available') : t('common.inUse')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
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
                    <p className="text-xs text-muted-foreground">{d.phone ?? d.user?.email}</p>
                  </div>
                  <Badge
                    className="rounded-lg"
                    variant={d.isAvailable ? 'default' : 'secondary'}
                  >
                    {d.isAvailable ? t('common.available') : t('common.onTrip')}
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
