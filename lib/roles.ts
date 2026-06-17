export const USER_ROLES = {
  MARUICHI_STAFF: 'MARUICHI_STAFF',
  SHINWA_STAFF: 'SHINWA_STAFF',
  SUBCONTRACTOR_STAFF: 'SUBCONTRACTOR_STAFF',
  DRIVER: 'DRIVER',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_LIST: UserRole[] = Object.values(USER_ROLES);

export function isUserRole(value: string): value is UserRole {
  return USER_ROLE_LIST.includes(value as UserRole);
}
