'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthPageShell } from '@/components/layout/auth-page-shell';
import { useTranslation } from '@/lib/i18n/context';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetUrl('');

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error === 'email_not_found') {
        setError(t('auth.emailNotFound'));
      } else {
        setError(t('auth.requestFailed'));
      }
      setLoading(false);
      return;
    }

    setResetUrl(data.resetUrl);
    setLoading(false);
  }

  return (
    <AuthPageShell>
      <Card className="relative w-full rounded-2xl border-0 shadow-soft sm:rounded-3xl">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-xl font-bold sm:text-2xl">{t('auth.forgotPasswordTitle')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{t('auth.forgotPasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {resetUrl ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{t('auth.resetLinkSent')}</p>
              <Button asChild className="w-full" size="lg">
                <Link href={resetUrl}>{t('auth.clickHere')}</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </div>
          ) : (
            <>
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-primary hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
