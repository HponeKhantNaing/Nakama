'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthPageShell } from '@/components/layout/auth-page-shell';
import { useTranslation } from '@/lib/i18n/context';

const REMEMBER_ME_KEY = 'mtms-remember-me';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const resetSuccess = searchParams.get('reset') === 'success';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [successKey, setSuccessKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_ME_KEY);
    if (saved === 'true') {
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (resetSuccess) {
      setSuccessKey('auth.passwordResetSuccess');
    }
  }, [resetSuccess]);

  function handleRememberMeChange(checked: boolean) {
    setRememberMe(checked);
    localStorage.setItem(REMEMBER_ME_KEY, checked ? 'true' : 'false');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorKey('');
    setSuccessKey('');

    const result = await signIn('credentials', {
      email,
      password,
      rememberMe: rememberMe ? 'true' : 'false',
      redirect: false,
    });

    if (result?.error) {
      setErrorKey('auth.invalidCredentials');
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <AuthPageShell>
      <Card className="relative mb-4 w-full rounded-2xl border-0 shadow-soft sm:mb-8 sm:rounded-3xl">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-xl font-bold sm:text-2xl">{t('app.name')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{t('app.fullName')}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@maruichi.jp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={handleRememberMeChange}
                />
                <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
                  {t('auth.rememberMe')}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('auth.forgotPassword')}{' '}
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  {t('auth.clickHere')}
                </Link>
              </p>
            </div>
            {successKey && <p className="text-sm text-green-600">{t(successKey)}</p>}
            {errorKey && <p className="text-sm text-destructive">{t(errorKey)}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
