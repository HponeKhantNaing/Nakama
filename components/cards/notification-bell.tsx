'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const router = useRouter();
  const { t } = useTranslation();
  const [toast, setToast] = useState<string | null>(null);
  const { connected, lastEvent } = useNotifications();

  useEffect(() => {
    if (lastEvent && lastEvent.type !== 'HEARTBEAT') {
      setToast(lastEvent.message);
      router.refresh();
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent, router]);

  return (
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span
          className={cn(
            'absolute right-1.5 top-1.5 h-2 w-2 rounded-full',
            connected ? 'bg-emerald-500' : 'bg-red-400'
          )}
          title={connected ? t('common.connected') : t('common.disconnected')}
        />
      </div>
      {toast && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border/60 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold">{lastEvent?.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{toast}</p>
        </div>
      )}
    </div>
  );
}
