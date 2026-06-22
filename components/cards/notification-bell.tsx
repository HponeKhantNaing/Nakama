'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { NotificationMetadata } from '@/lib/notifications';
import type { TranslationKey } from '@/lib/i18n';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: NotificationMetadata | null;
};

function notificationTypeKey(type: string): TranslationKey {
  return `notification.type.${type}` as TranslationKey;
}

function tone(type: string) {
  if (type.includes('COMPLETE') || type.includes('CONFIRMED')) {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (type.includes('REJECT')) return 'bg-rose-50 text-rose-700';
  if (type.includes('ASSIGNED') || type.includes('NEW_REQUEST')) {
    return 'bg-blue-50 text-blue-700';
  }
  if (type.includes('GPS')) return 'bg-muted/50 text-muted-foreground';
  return 'bg-amber-50 text-amber-700';
}

export function NotificationBell() {
  const router = useRouter();
  const { t, formatDate } = useTranslation();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const { connected, lastEvent } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (lastEvent && lastEvent.type !== 'HEARTBEAT') {
      setToast({ title: lastEvent.title, message: lastEvent.message });
      fetchNotifications();
      router.refresh();
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent, router, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleNotificationClick(notification: NotificationItem) {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    const href =
      notification.metadata && typeof notification.metadata === 'object'
        ? notification.metadata.href
        : undefined;
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 transition-colors hover:bg-muted"
        aria-label={t('delivery.notificationCenter')}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          className={cn(
            'absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-background',
            connected ? 'bg-emerald-500' : 'bg-red-400'
          )}
          title={connected ? t('common.connected') : t('common.disconnected')}
        />
      </button>

      {toast && !open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border/60 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{toast.message}</p>
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-12 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{t('delivery.notificationCenter')}</p>
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0
                  ? t('delivery.unreadCount').replace('{count}', String(unreadCount))
                  : t('delivery.allCaughtUp')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={markAllRead}
                  aria-label={t('delivery.markAllRead')}
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t('delivery.noNotifications')}
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/40',
                      !notification.isRead
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-border/60 bg-white'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{notification.title}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-medium',
                          tone(notification.type)
                        )}
                      >
                        {t(notificationTypeKey(notification.type))}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {formatDate(notification.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
