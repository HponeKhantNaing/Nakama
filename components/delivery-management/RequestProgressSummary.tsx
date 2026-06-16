'use client';

import { Card, CardContent } from '@/components/ui/card';

export function RequestProgressSummary({
  totalBoxes,
  deliveredBoxes,
  remainingBoxes,
  totalWeight,
  deliveredWeight,
  remainingWeight,
  overallProgress,
  status,
}: {
  totalBoxes: number;
  deliveredBoxes: number;
  remainingBoxes: number;
  totalWeight: number;
  deliveredWeight: number;
  remainingWeight: number;
  overallProgress: number;
  status: string;
}) {
  return (
    <Card className="rounded-2xl border-primary/10 bg-gradient-to-br from-white to-muted/20">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Request Summary</p>
          <span className="rounded-xl bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Boxes</p>
            <p className="text-xl font-bold">{totalBoxes}</p>
            <p className="mt-1 text-xs text-emerald-600">
              Delivered: {deliveredBoxes} · Remaining: {remainingBoxes}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Weight</p>
            <p className="text-xl font-bold">{totalWeight} kg</p>
            <p className="mt-1 text-xs text-emerald-600">
              Delivered: {deliveredWeight} kg · Remaining: {remainingWeight} kg
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Overall Progress</p>
            <p className="text-xl font-bold">{overallProgress}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
