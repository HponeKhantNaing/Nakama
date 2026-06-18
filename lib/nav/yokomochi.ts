import type { TranslationKey } from '@/lib/i18n';

export const warehouseNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/warehouse/factory-requests', labelKey: 'nav.factoryRequests' },
  { href: '/warehouse/negotiations', labelKey: 'nav.negotiations' },
  { href: '/warehouse/internal-fleet', labelKey: 'nav.internalFleet' },
  { href: '/warehouse/external-carrier', labelKey: 'nav.externalCarrier' },
  { href: '/warehouse/subcontractors', labelKey: 'nav.subcontractors' },
  { href: '/warehouse/history', labelKey: 'nav.deliveryHistory' },
];

export const factoryNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/factory/requests', labelKey: 'nav.factoryRequests' },
];

export const carrierNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/carrier/requests', labelKey: 'nav.newRequests' },
  { href: '/carrier/fleet', labelKey: 'nav.driversAndVehicles' },
  { href: '/carrier/accepted', labelKey: 'nav.acceptedJobs' },
  { href: '/carrier/subcontract', labelKey: 'nav.subcontract' },
  { href: '/carrier/completed', labelKey: 'nav.deliveredRequests' },
];
