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

type Vehicle = {
  id: string;
  plateNumber: string;
  vehicleType: string;
  isAvailable: boolean;
};

export function SubcontractorDriversClient({
  drivers,
  vehicles,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const { t } = useTranslation();

  function vehicleLabel(type: string) {
    const key = `vehicle.${type}` as TranslationKey;
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
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{v.plateNumber}</p>
                    <p className="text-xs text-muted-foreground">{vehicleLabel(v.vehicleType)}</p>
                  </div>
                  <Badge variant={v.isAvailable ? 'default' : 'secondary'} className="rounded-lg">
                    {v.isAvailable ? t('common.available') : t('common.inUse')}
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
