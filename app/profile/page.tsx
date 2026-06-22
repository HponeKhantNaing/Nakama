import { requireAuth } from '@/lib/session';
import { DashboardShell, PageHeader } from '@/components/layout/dashboard-shell';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { getNavItemsForRole, ROLE_TITLE_KEYS } from '@/lib/nav/by-role';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { company: { select: { name: true } } },
  });

  if (!user) {
    return null;
  }

  const navItems = getNavItemsForRole(session.user.role);
  const titleKey = ROLE_TITLE_KEYS[session.user.role];

  return (
    <DashboardShell titleKey={titleKey} navItems={navItems}>
      <PageHeader titleKey="profile.title" subtitleKey="profile.subtitle" />
      <ProfileForm
        email={user.email}
        initialName={user.name}
        companyName={user.company.name}
      />
    </DashboardShell>
  );
}
