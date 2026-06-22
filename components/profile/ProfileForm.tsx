'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, KeyRound, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { changeProfilePassword, updateProfileName } from '@/app/actions/profile';
import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

function StatusMessage({ message, successText }: { message: string; successText: string }) {
  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        message === successText
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-destructive/10 text-destructive'
      )}
    >
      {message}
    </p>
  );
}

export function ProfileForm({
  email,
  initialName,
  companyName,
}: {
  email: string;
  initialName: string;
  companyName: string;
}) {
  const { t } = useTranslation();
  const { update: updateSession } = useSession();
  const [name, setName] = useState(initialName);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPendingName, startNameTransition] = useTransition();
  const [isPendingPassword, startPasswordTransition] = useTransition();

  const initial = initialName.charAt(0).toUpperCase() || 'U';

  function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMessage(null);
    startNameTransition(async () => {
      const result = await updateProfileName({ name });
      if (!result.success) {
        setNameMessage(result.error ?? t('profile.updateFailed'));
        return;
      }
      await updateSession({ name });
      setNameMessage(t('profile.nameUpdated'));
    });
  }

  function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await changeProfilePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.success) {
        setPasswordMessage(result.error ?? t('profile.updateFailed'));
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t('profile.passwordUpdated'));
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-2 lg:items-start">
      {/* Left: account info + change name */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b border-border/60 pb-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary">
                {initial}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg">{initialName}</CardTitle>
                <CardDescription className="mt-1 truncate">{companyName}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <p className="text-sm font-medium text-foreground">{t('profile.accountInfo')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t('profile.email')}</p>
                  <p className="mt-0.5 truncate text-sm font-medium">{email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t('profile.company')}</p>
                  <p className="mt-0.5 truncate text-sm font-medium">{companyName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <UserRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('profile.changeName')}</CardTitle>
                <CardDescription>{t('profile.changeNameHint')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">{t('profile.displayName')}</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  className="h-11 rounded-xl"
                />
              </div>
              {nameMessage && (
                <StatusMessage message={nameMessage} successText={t('profile.nameUpdated')} />
              )}
              <Button
                type="submit"
                disabled={isPendingName || name.trim() === initialName}
                className="h-11 w-full rounded-xl sm:w-auto"
              >
                {isPendingName ? t('common.saving') : t('profile.saveName')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Right: change password */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('profile.changePassword')}</CardTitle>
              <CardDescription>{t('profile.changePasswordHint')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('profile.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('profile.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('profile.confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
            </div>
            {passwordMessage && (
              <StatusMessage
                message={passwordMessage}
                successText={t('profile.passwordUpdated')}
              />
            )}
            <Button type="submit" disabled={isPendingPassword} className="h-11 w-full rounded-xl">
              {isPendingPassword ? t('common.saving') : t('profile.savePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
