'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

const navItems = [
  { href: '/shinwa/incoming', labelKey: 'nav.incoming' as const },
  { href: '/shinwa/fleet', labelKey: 'nav.fleet' as const },
  { href: '/shinwa/subcontract', labelKey: 'nav.subcontract' as const },
];

type Vehicle = {
  id: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  isAvailable: boolean;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  isAvailable: boolean;
  user?: { email: string } | null;
};

export function ShinwaFleetClient({
  vehicles,
  drivers,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
}) {
  const { t } = useTranslation();

  function vehicleLabel(type: string) {
    const key = `vehicle.${type}` as TranslationKey;
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
                    <p className="text-xs text-muted-foreground">
                      {vehicleLabel(v.vehicleType)} — {v.capacity} kg
                    </p>
                  </div>
                  <Badge
                    className="rounded-lg"
                    variant={v.isAvailable ? 'default' : 'secondary'}
                  >
                    {v.isAvailable ? t('common.available') : t('common.inUse')}
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
