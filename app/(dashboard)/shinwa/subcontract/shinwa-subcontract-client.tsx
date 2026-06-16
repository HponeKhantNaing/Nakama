'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';

import { shinwaNavItems } from '@/lib/nav/shinwa';

const navItems = shinwaNavItems;

type Request = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  updatedAt: Date;
  tripAllocation?: {
    driver: { name: string };
    vehicle?: { plateNumber: string } | null;
    truck?: { plateNumber: string } | null;
  } | null;
};

export function ShinwaSubcontractClient({ requests }: { requests: Request[] }) {
  return (
    <DashboardShell titleKey="dashboard.shinwa" navItems={navItems}>
      <div className="space-y-6">
        <PageHeader titleKey="shinwa.subcontractedOrders" />
        <StatusTable requests={requests} />
      </div>
    </DashboardShell>
  );
}
