'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { DriverJobCard } from '@/components/cards/driver-job-card';
import { StatusTable } from '@/components/tables/status-table';
import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

const navItems = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' as const },
  { href: '/driver/history', labelKey: 'nav.history' as const },
];

type ActiveJob = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  cargoType: string;
  cargoWeight: number;
  status: string;
  expectedPickupDate: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle: { plateNumber: string };
  } | null;
};

type HistoryRequest = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  updatedAt: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle: { plateNumber: string };
  } | null;
};

export function DriverActiveJobClient({
  activeJob,
  history,
}: {
  activeJob: ActiveJob | null;
  history: HistoryRequest[];
}) {
  const { t } = useTranslation();

  return (
    <DashboardShell titleKey="dashboard.driver" navItems={navItems}>
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader titleKey="driver.activeJob" />
        {activeJob ? (
          <DriverJobCard job={activeJob} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">{t('driver.noActiveJob')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('driver.noActiveJobDesc')}</p>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <div>
            <PageHeader titleKey="driver.recentCompleted" />
            <StatusTable requests={history.slice(0, 5)} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
