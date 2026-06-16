import type { TranslationKey } from '@/lib/i18n';

export const shinwaNavItems: { href: string; labelKey: TranslationKey }[] = [
  { href: '/shinwa/incoming', labelKey: 'nav.newRequests' },
  { href: '/shinwa/delivered', labelKey: 'nav.deliveredRequests' },
  { href: '/shinwa/fleet', labelKey: 'nav.fleet' },
  { href: '/shinwa/subcontract', labelKey: 'nav.subcontract' },
];
