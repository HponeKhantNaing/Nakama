'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { useTranslation } from '@/lib/i18n/context';
import { DeliveryManagementBoard } from '@/components/delivery-management/DeliveryManagementBoard';
import { shinwaNavItems } from '@/lib/nav/shinwa';

type Driver = { id: string; name: string; isAvailable: boolean };
type Truck = {
  id: string;
  truckNo: string | null;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};
type Subcontractor = { id: string; name: string };

interface ShinwaIncomingClientProps {
  board: any;
  drivers: Driver[];
  trucks: Truck[];
  subcontractors: Subcontractor[];
}

export function ShinwaIncomingClient({ board, drivers, trucks, subcontractors }: ShinwaIncomingClientProps) {
  const { t } = useTranslation();

  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={shinwaNavItems}>
      <div className="space-y-4">
        <PageHeader titleKey="shinwa.newOrders" subtitleKey="shinwa.newOrdersDesc" />
        <DeliveryManagementBoard
          data={board}
          trucks={trucks}
          drivers={drivers}
          subcontractors={subcontractors}
          variant="active"
        />
      </div>
    </DashboardShell>
  );
}
