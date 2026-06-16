'use client';

import { Card, CardContent } from '@/components/ui/card';

export function DriverStatsCard({
  stats,
}: {
  stats: {
    completedDeliveries: number;
    activeDeliveries: number;
    pendingDeliveries: number;
    totalBoxesDelivered: number;
    totalWeightDelivered: number;
  };
}) {
  const items = [
    { label: 'Completed', value: stats.completedDeliveries },
    { label: 'Active', value: stats.activeDeliveries },
    { label: 'Pending', value: stats.pendingDeliveries },
    { label: 'Boxes Delivered', value: stats.totalBoxesDelivered },
    { label: 'Weight Delivered (kg)', value: stats.totalWeightDelivered },
  ];

  return (
    <Card className="rounded-3xl">
      <CardContent className="p-4">
        <p className="text-sm font-semibold">Today’s Summary</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {items.map((i) => (
            <div key={i.label} className="rounded-2xl bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">{i.label}</p>
              <p className="mt-1 text-lg font-bold">{i.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

