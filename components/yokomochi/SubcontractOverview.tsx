'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

type Assignment = {
  id: string;
  assignedTrips: number;
  createdAt: Date;
  subcontractor: { name: string };
  trip: {
    tripCode: string;
    pallets: number;
    status: string;
    yokomochiOrder: { orderNo: string; status: string };
  };
};

export function SubcontractOverview({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No subcontract assignments yet. They appear when carrier capacity is insufficient.
      </div>
    );
  }

  const bySub = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    const key = a.subcontractor.name;
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(bySub).map(([name, items]) => (
        <div key={name} className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b bg-muted/30 px-4 py-3">
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{items.length} trip(s) assigned</p>
          </div>
          {items.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0">
              <div>
                <p className="font-mono text-xs">{a.trip.yokomochiOrder.orderNo}</p>
                <p>
                  {a.trip.tripCode} · {a.trip.pallets}p
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
              </div>
              <Badge variant="outline">{a.trip.status.replace(/_/g, ' ')}</Badge>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
