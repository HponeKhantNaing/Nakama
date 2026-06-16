'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useTranslation } from '@/lib/i18n/context';
import { Truck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('auth.invalidCredentials'));
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-6 top-6">
        <LanguageToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5" />
      </div>

      <Card className="relative w-full max-w-md rounded-3xl border-0 shadow-soft">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Truck className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('app.name')}</CardTitle>
          <CardDescription className="text-sm">{t('app.fullName')}</CardDescription>
        </CardHeader>
        <CardContent>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
          <div className="mt-6 rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{t('auth.demoAccounts')}</p>
            <ul className="mt-2 space-y-1">
              <li>staff@maruichi.jp — {t('auth.role.maruichi')}</li>
              <li>staff@shinwa.jp — {t('auth.role.shinwa')}</li>
              <li>staff@kansai-logistics.jp — {t('auth.role.subcontractor')}</li>
              <li>driver@shinwa.jp — {t('auth.role.driver')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
