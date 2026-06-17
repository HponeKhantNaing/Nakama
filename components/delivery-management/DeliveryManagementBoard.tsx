'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequestAccordion } from './RequestAccordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Truck = {
  id: string;
  truckNo: string | null;
  truckType: string;
  capacityWeightKg: number;
  maxBoxes: number;
  status: string;
};
type Driver = { id: string; name: string; isAvailable: boolean };
type Subcontractor = { id: string; name: string };

export type BoardResponse = {
  requests: any[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    total: number;
    pending: number;
    assigned: number;
    inTransit: number;
    delivered: number;
    cancelled: number;
  };
};

function buildUrl(params: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(params.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') next.delete(k);
    else next.set(k, v);
  }
  return `?${next.toString()}`;
}

export function DeliveryManagementBoard({
  data,
  trucks,
  drivers,
  subcontractors,
  variant = 'active',
}: {
  data: BoardResponse;
  trucks: Truck[];
  drivers: Driver[];
  subcontractors: Subcontractor[];
  variant?: 'active' | 'delivered';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');

  const page = Number(params.get('page') ?? data.page ?? 1);
  const canPrev = page > 1;
  const canNext = page < data.totalPages;

  return (
    <div className="space-y-4">
      {/* Compact stats — active page only */}
      {variant === 'active' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{data.stats.pending}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold">{data.stats.assigned + data.stats.inTransit}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">Active Total</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
        </div>
      )}

      {variant === 'delivered' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">Delivered</p>
            <p className="text-2xl font-bold">{data.stats.delivered}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">Cancelled</p>
            <p className="text-2xl font-bold">{data.stats.cancelled}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 sm:col-span-1 col-span-2">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              router.push(buildUrl(params, { search: search.trim(), page: '1' }));
            }
          }}
          placeholder="Search request no, origin, destination..."
          className="max-w-md"
        />
        <Button
          variant="outline"
          onClick={() => router.push(buildUrl(params, { search: search.trim(), page: '1' }))}
        >
          Search
        </Button>
        {params.get('search') && (
          <Button variant="ghost" onClick={() => router.push(buildUrl(params, { search: null, page: '1' }))}>
            Clear
          </Button>
        )}
      </div>

      <RequestAccordion
        requests={data.requests}
        trucks={trucks}
        drivers={drivers}
        subcontractors={subcontractors}
        variant={variant}
      />

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} requests
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!canPrev} onClick={() => router.push(buildUrl(params, { page: String(page - 1) }))}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!canNext} onClick={() => router.push(buildUrl(params, { page: String(page + 1) }))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
