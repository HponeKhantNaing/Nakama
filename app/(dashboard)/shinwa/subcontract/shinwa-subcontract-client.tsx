'use client';

import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { StatusTable } from '@/components/tables/status-table';

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
