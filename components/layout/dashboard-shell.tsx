'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Responsive side nav: compact icon rail on phones, full sidebar on desktop. */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col bg-sidebar text-sidebar-foreground sm:w-20 lg:w-64">
        <div className="flex h-16 items-center justify-center border-b border-white/10 px-2 lg:justify-start lg:gap-3 lg:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="text-sm font-bold text-white">{t('app.name')}</p>
            <p className="text-[10px] text-sidebar-muted">{t(titleKey)}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 lg:p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const icon = item.icon ?? navIconMap[item.labelKey];
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.labelKey)}
                className={cn(
                  'flex min-w-0 items-center justify-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 lg:justify-start lg:gap-3 lg:px-4',
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-sidebar-muted hover:bg-white/5 hover:text-white'
                )}
              >
                <span className={cn('shrink-0', isActive && 'text-primary')}>{icon}</span>
                <span className="hidden truncate lg:inline">{t(item.labelKey)}</span>
                {isActive && (
                  <span className="hidden h-1.5 w-1.5 rounded-full bg-primary lg:ml-auto lg:block" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2 lg:p-4">
          {/* User details stay visible on desktop; mobile keeps only the avatar to protect content width. */}
          <div className="mb-3 flex items-center justify-center rounded-xl bg-white/5 px-2 py-2 lg:justify-start lg:gap-3 lg:px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {session?.user?.name?.charAt(0) ?? 'U'}
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-xs font-medium text-white">{session?.user?.name}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{session?.user?.companyName}</p>
            </div>
          </div>
          <button
            type="button"
            title={t('nav.logout')}
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white lg:justify-start lg:gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content offset matches the responsive side nav width on every screen size. */}
      <div className="flex min-w-0 flex-1 flex-col pl-16 sm:pl-20 lg:pl-64">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-border/60 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{t('app.dashboard')}</h1>
              <p className="text-xs text-muted-foreground">{t('app.welcomeBack')}, {session?.user?.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:p-8">{children}</main>
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
    <div className="mb-6">
      <h2 className="page-title">{t(titleKey)}</h2>
      {subtitleKey && <p className="page-subtitle mt-1">{t(subtitleKey)}</p>}
    </div>
  );
}
