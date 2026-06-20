'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequestAccordion } from './RequestAccordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

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
  const { t } = useTranslation();
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
            <p className="text-xs text-muted-foreground">{t('status.PENDING')}</p>
            <p className="text-2xl font-bold">{data.stats.pending}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('delivery.inProgress')}</p>
            <p className="text-2xl font-bold">{data.stats.assigned + data.stats.inTransit}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('delivery.activeTotal')}</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
        </div>
      )}

      {variant === 'delivered' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('status.DELIVERED')}</p>
            <p className="text-2xl font-bold">{data.stats.delivered}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('shinwa.cancelled')}</p>
            <p className="text-2xl font-bold">{data.stats.cancelled}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 sm:col-span-1 col-span-2">
            <p className="text-xs text-muted-foreground">{t('delivery.total')}</p>
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
          placeholder={t('delivery.searchPlaceholder')}
          className="max-w-md"
        />
        <Button
          variant="outline"
          onClick={() => router.push(buildUrl(params, { search: search.trim(), page: '1' }))}
        >
          {t('common.search')}
        </Button>
        {params.get('search') && (
          <Button variant="ghost" onClick={() => router.push(buildUrl(params, { search: null, page: '1' }))}>
            {t('common.clear')}
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
            {interpolate(t('board.pageInfo'), {
              page: data.page,
              totalPages: data.totalPages,
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!canPrev} onClick={() => router.push(buildUrl(params, { page: String(page - 1) }))}>
              {t('common.previous')}
            </Button>
            <Button size="sm" variant="outline" disabled={!canNext} onClick={() => router.push(buildUrl(params, { page: String(page + 1) }))}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
