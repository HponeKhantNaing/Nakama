'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { useNotifications } from '@/hooks/useNotifications';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
};

function tone(type: string) {
  if (type.includes('CUSTOMER')) return 'bg-emerald-50 text-emerald-700';
  if (type.includes('DELIVERY')) return 'bg-blue-50 text-blue-700';
  if (type.includes('GPS')) return 'bg-muted/40 text-muted-foreground';
  return 'bg-amber-50 text-amber-700';
}

export function NotificationCenter({ notifications }: { notifications: NotificationRow[] }) {
  const { t, formatDate } = useTranslation();
  const { lastEvent } = useNotifications();

  const unread = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t('delivery.notificationCenter')}</p>
          <Badge
            className={cn(
              'rounded-xl border-0 px-3 py-1',
              unread > 0 ? 'bg-rose-50 text-rose-700' : 'bg-muted/40 text-muted-foreground'
            )}
          >
            {interpolate(t('delivery.unreadCount'), { count: unread })}
          </Badge>
        </div>

        {lastEvent && lastEvent.type !== 'HEARTBEAT' && (
          <div className="rounded-2xl bg-primary/10 p-3 text-xs">
            <p className="font-semibold text-primary">{t('common.live')}</p>
            <p className="text-muted-foreground">
              {lastEvent.title}: {lastEvent.message}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {notifications.slice(0, 8).map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(n.createdAt)}</p>
              </div>
              <Badge className={cn('rounded-xl border-0 px-2 py-1 text-[10px]', tone(n.type))}>
                {n.type}
              </Badge>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t('delivery.noNotifications')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
