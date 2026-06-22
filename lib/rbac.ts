import { UserRole, USER_ROLES } from '@/lib/roles';

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  [USER_ROLES.MARUICHI_STAFF]: '/warehouse',
  [USER_ROLES.SHINWA_STAFF]: '/carrier',
  [USER_ROLES.SUBCONTRACTOR_STAFF]: '/subcontractor',
  [USER_ROLES.DRIVER]: '/driver',
  [USER_ROLES.FACTORY_STAFF]: '/factory/requests',
};

export const ROLE_ROUTE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.MARUICHI_STAFF]: ['/warehouse', '/maruichi'],
  [USER_ROLES.SHINWA_STAFF]: ['/carrier', '/shinwa'],
  [USER_ROLES.SUBCONTRACTOR_STAFF]: ['/subcontractor'],
  [USER_ROLES.DRIVER]: ['/driver'],
  [USER_ROLES.FACTORY_STAFF]: ['/factory'],
};

export function getDashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARD_MAP[role];
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return true;
  }
  const allowedPrefixes = ROLE_ROUTE_PERMISSIONS[role];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/delivery/confirm',
  '/confirm',
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
