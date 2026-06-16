import { UserRole } from '@prisma/client';

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  [UserRole.MARUICHI_STAFF]: '/maruichi',
  [UserRole.SHINWA_STAFF]: '/shinwa',
  [UserRole.SUBCONTRACTOR_STAFF]: '/subcontractor',
  [UserRole.DRIVER]: '/driver',
};

export const ROLE_ROUTE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.MARUICHI_STAFF]: ['/maruichi'],
  [UserRole.SHINWA_STAFF]: ['/shinwa'],
  [UserRole.SUBCONTRACTOR_STAFF]: ['/subcontractor'],
  [UserRole.DRIVER]: ['/driver'],
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

export const PUBLIC_ROUTES = ['/login', '/api/auth', '/delivery/confirm', '/confirm'];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
