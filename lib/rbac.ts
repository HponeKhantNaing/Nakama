import { UserRole, USER_ROLES } from '@/lib/roles';

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  [USER_ROLES.MARUICHI_STAFF]: '/maruichi',
  [USER_ROLES.SHINWA_STAFF]: '/shinwa',
  [USER_ROLES.SUBCONTRACTOR_STAFF]: '/subcontractor',
  [USER_ROLES.DRIVER]: '/driver',
};

export const ROLE_ROUTE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.MARUICHI_STAFF]: ['/maruichi'],
  [USER_ROLES.SHINWA_STAFF]: ['/shinwa'],
  [USER_ROLES.SUBCONTRACTOR_STAFF]: ['/subcontractor'],
  [USER_ROLES.DRIVER]: ['/driver'],
};

export function getDashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARD_MAP[role];
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
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
