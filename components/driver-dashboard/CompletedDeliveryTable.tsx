'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, statusColor } from '@/lib/utils';

type Row = {
  id: string;
  requestNo: string;
  origin: string;
  destination: string;
  status: string;
  deliveredAt: Date | null;
  cargoWeight?: number;
  totalQuantity?: number;
  truckAssignments?: {
    id: string;
    assignedQuantity: number;
    assignedWeight: number;
    truck?: { truckNo: string | null } | null;
    driver?: { name: string } | null;
    assignmentConfirmation?: { approved: boolean } | null;
  }[];
};

export function CompletedDeliveryTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      return (
        r.requestNo.toLowerCase().includes(query) ||
        r.origin.toLowerCase().includes(query) ||
        r.destination.toLowerCase().includes(query)
      );
    });
  }, [rows, q]);

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Completed Delivery History</p>
            <p className="text-xs text-muted-foreground">Searchable list of your recent jobs.</p>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search request / origin / destination..."
            className="sm:w-[320px]"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Boxes</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Confirmed</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const boxes =
                  r.truckAssignments?.reduce((s, a) => s + (a.assignedQuantity ?? 0), 0) ??
                  r.totalQuantity ??
                  0;
                const weight =
                  r.truckAssignments?.reduce((s, a) => s + (a.assignedWeight ?? 0), 0) ??
                  r.cargoWeight ??
                  0;
                const confirmed =
                  r.truckAssignments?.some((a) => a.assignmentConfirmation?.approved) ?? false;

                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{r.requestNo}</td>
                    <td className="px-4 py-3">{r.origin}</td>
                    <td className="px-4 py-3">{r.destination}</td>
                    <td className="px-4 py-3">{boxes}</td>
                    <td className="px-4 py-3">{Math.round(weight)} kg</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.deliveredAt ? formatDate(r.deliveredAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'rounded-xl border-0',
                          confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {confirmed ? 'YES' : 'NO'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('rounded-xl font-normal', statusColor(r.status))}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

