'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/cards/notification-bell';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { AppLogo } from '@/components/ui/app-logo';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import {
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
  Truck,
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
  'nav.factoryRequests': <ClipboardList className="h-5 w-5" />,
  'nav.negotiations': <GitBranch className="h-5 w-5" />,
  'nav.internalFleet': <Truck className="h-5 w-5" />,
  'nav.externalCarrier': <Navigation className="h-5 w-5" />,
  'nav.subcontractors': <Users className="h-5 w-5" />,
  'nav.deliveryHistory': <History className="h-5 w-5" />,
  'nav.acceptedJobs': <ClipboardList className="h-5 w-5" />,
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
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-border bg-sidebar sm:h-16">
        <div className="flex h-full w-[min(18rem,82vw)] shrink-0 items-center gap-3 border-r border-border px-3 sm:px-5 lg:w-64 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-sidebar-muted hover:bg-black/5 hover:text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <AppLogo size="md" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">{t('app.name')}</p>
            <p className="truncate text-[10px] text-sidebar-muted">{t(titleKey)}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <LayoutDashboard className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
            <div className="min-w-0 max-[380px]:hidden">
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
        </div>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-black/50 sm:top-16 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          // Responsive side navigation: drawer on small screens, fixed side rail on desktop.
          'fixed bottom-0 left-0 z-40 flex w-[min(18rem,82vw)] flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out top-14 sm:top-16 lg:w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
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
                    ? 'bg-black/5 text-sidebar-foreground shadow-sm'
                    : 'text-sidebar-muted hover:bg-black/5 hover:text-sidebar-foreground'
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

        <div className="border-t border-border p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {session?.user?.name?.charAt(0) ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{session?.user?.name}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{session?.user?.companyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-sidebar-muted transition-colors hover:bg-black/5 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pt-14 sm:pt-16 lg:pl-64">
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
