import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/lib/roles';
import { redirect } from 'next/navigation';
import { getDashboardForRole } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function getSession() {
  return getServerSession(authOptions);
}

/** Resolve DB user id — JWT may be stale after db reset/reseed. */
export async function resolveSessionUserId(session: {
  user: { id?: string; email?: string | null };
}): Promise<string | undefined> {
  const { id, email } = session.user;
  if (id) {
    const byId = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (byId) return byId.id;
  }
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) return byEmail.id;
  }
  return undefined;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  return session;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.user.role)) {
    redirect(getDashboardForRole(session.user.role));
  }
  return session;
}
