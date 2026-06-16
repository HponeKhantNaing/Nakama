'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { DeliveryManagementBoard } from '@/components/delivery-management/DeliveryManagementBoard';
import { shinwaNavItems } from '@/lib/nav/shinwa';

type Driver = { id: string; name: string; isAvailable: boolean };
type Truck = {
  id: string;
  truckNo: string;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};
type Subcontractor = { id: string; name: string };

export function ShinwaDeliveredClient({
  board,
  drivers,
  trucks,
  subcontractors,
}: {
  board: any;
  drivers: Driver[];
  trucks: Truck[];
  subcontractors: Subcontractor[];
}) {
  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={shinwaNavItems}>
      <div className="space-y-4">
        <PageHeader titleKey="shinwa.deliveredOrders" subtitleKey="shinwa.deliveredOrdersDesc" />
        <DeliveryManagementBoard
          data={board}
          trucks={trucks}
          drivers={drivers}
          subcontractors={subcontractors}
          variant="delivered"
        />
      </div>
    </DashboardShell>
  );
}
