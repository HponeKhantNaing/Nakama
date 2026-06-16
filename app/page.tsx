import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDashboardForRole } from '@/lib/rbac';

export default async function HomePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  redirect(getDashboardForRole(session.user.role));
}
