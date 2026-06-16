'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptOrder, rejectOrder } from '@/app/actions/transport';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';
import { FleetAllocationModal } from '@/components/dialogs/fleet-allocation-modal';
import { ForwardSubcontractModal } from '@/components/dialogs/forward-subcontract-modal';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/context';

const navItems = [
  { href: '/shinwa/incoming', labelKey: 'nav.incoming' as const },
  { href: '/shinwa/fleet', labelKey: 'nav.fleet' as const },
  { href: '/shinwa/subcontract', labelKey: 'nav.subcontract' as const },
];

type Request = {
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

type Driver = { id: string; name: string; isAvailable: boolean };
type Vehicle = { id: string; plateNumber: string; isAvailable: boolean };
type Subcontractor = { id: string; name: string };

interface ShinwaIncomingClientProps {
  requests: Request[];
  drivers: Driver[];
  vehicles: Vehicle[];
  subcontractors: Subcontractor[];
}

export function ShinwaIncomingClient({
  requests,
  drivers,
  vehicles,
  subcontractors,
}: ShinwaIncomingClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  function handleAccept(id: string) {
    startTransition(async () => {
      await acceptOrder(id);
      router.refresh();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectOrder(id);
      router.refresh();
    });
  }

  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="shinwa.incomingOrders" />
        <StatusTable
          requests={requests}
          actions={(req) => (
            <div className="flex flex-wrap gap-2">
              {req.status === 'PENDING' && (
                <>
                  <Button size="sm" disabled={isPending} onClick={() => handleAccept(req.id)}>
                    {t('shinwa.accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleReject(req.id)}
                  >
                    {t('shinwa.reject')}
                  </Button>
                  <FleetAllocationModal
                    requestId={req.id}
                    drivers={drivers}
                    vehicles={vehicles}
                  />
                  <ForwardSubcontractModal
                    requestId={req.id}
                    subcontractors={subcontractors}
                  />
                </>
              )}
              {req.status === 'SHINWA_ACCEPTED' && (
                <FleetAllocationModal
                  requestId={req.id}
                  drivers={drivers}
                  vehicles={vehicles}
                />
              )}
            </div>
          )}
        />
      </div>
    </DashboardShell>
  );
}
