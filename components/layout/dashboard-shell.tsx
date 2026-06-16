'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/cards/notification-bell';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import {
  Truck,
  LogOut,
  LayoutDashboard,
  BarChart3,
  History,
  Inbox,
  Users,
  GitBranch,
  ClipboardList,
  Navigation,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon?: React.ReactNode;
}

interface DashboardShellProps {
  titleKey: TranslationKey;
  navItems: NavItem[];
  children: React.ReactNode;
}

const navIconMap: Partial<Record<TranslationKey, React.ReactNode>> = {
  'nav.requests': <ClipboardList className="h-5 w-5" />,
  'nav.analytics': <BarChart3 className="h-5 w-5" />,
  'nav.history': <History className="h-5 w-5" />,
  'nav.incoming': <Inbox className="h-5 w-5" />,
  'nav.newRequests': <Inbox className="h-5 w-5" />,
  'nav.deliveredRequests': <History className="h-5 w-5" />,
  'nav.fleet': <Truck className="h-5 w-5" />,
  'nav.subcontract': <GitBranch className="h-5 w-5" />,
  'nav.assignedOrders': <ClipboardList className="h-5 w-5" />,
  'nav.drivers': <Users className="h-5 w-5" />,
  'nav.activeJob': <Navigation className="h-5 w-5" />,
};

export function DashboardShell({ titleKey, navItems, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{t('app.name')}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{t(titleKey)}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-sidebar-muted hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 sm:p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const icon = item.icon ?? navIconMap[item.labelKey];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 sm:px-4',
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-sidebar-muted hover:bg-white/5 hover:text-white'
                )}
              >
                <span className={cn(isActive && 'text-primary')}>{icon}</span>
                <span className="truncate">{t(item.labelKey)}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {session?.user?.name?.charAt(0) ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{session?.user?.name}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{session?.user?.companyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-white/80 px-3 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <LayoutDashboard className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{t('app.dashboard')}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {t('app.welcomeBack')}, {session?.user?.name}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  titleKey,
  subtitleKey,
}: {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 sm:mb-6">
      <h2 className="page-title">{t(titleKey)}</h2>
      {subtitleKey && <p className="page-subtitle mt-1">{t(subtitleKey)}</p>}
    </div>
  );
}
