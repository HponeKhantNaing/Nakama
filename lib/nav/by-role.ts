import type { TranslationKey } from '@/lib/i18n';
import type { UserRole } from '@/lib/roles';
import { warehouseNavItems, factoryNavItems, carrierNavItems } from '@/lib/nav/yokomochi';
import { shinwaNavItems } from '@/lib/nav/shinwa';

const driverNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/driver/active-job', labelKey: 'nav.activeJob' },
  { href: '/driver/history', labelKey: 'nav.history' },
];

const subcontractorNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/subcontractor/assigned', labelKey: 'nav.assignedOrders' },
  { href: '/subcontractor/drivers', labelKey: 'nav.drivers' },
];

const maruichiNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/maruichi', labelKey: 'nav.requests' },
  { href: '/maruichi/analytics', labelKey: 'nav.analytics' },
  { href: '/maruichi/history', labelKey: 'nav.history' },
];

export const ROLE_TITLE_KEYS: Record<UserRole, TranslationKey> = {
  MARUICHI_STAFF: 'dashboard.warehouse',
  FACTORY_STAFF: 'dashboard.factory',
  SHINWA_STAFF: 'dashboard.carrier',
  DRIVER: 'dashboard.driver',
  SUBCONTRACTOR_STAFF: 'dashboard.subcontractor',
};

export function getNavItemsForRole(role: UserRole): { href: string; labelKey: TranslationKey }[] {
  switch (role) {
    case 'MARUICHI_STAFF':
      return warehouseNavItems;
    case 'FACTORY_STAFF':
      return factoryNavItems;
    case 'SHINWA_STAFF':
      return carrierNavItems;
    case 'DRIVER':
      return driverNavItems;
    case 'SUBCONTRACTOR_STAFF':
      return subcontractorNavItems;
    default:
      return maruichiNavItems;
  }
}
