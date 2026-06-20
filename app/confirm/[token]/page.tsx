'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Package, User } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

interface ConfirmData {
  requestNo: string;
  customer: string;
  driver?: string;
  truck?: string;
  items: { quantity: number; totalWeight: number; product: { name: string; sku: string } }[];
  arrivedAt: string | null;
  alreadyConfirmed: boolean;
}

export default function ConfirmPage() {
  const { t, formatDate } = useTranslation();
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ConfirmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/confirm/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          if (d.alreadyConfirmed) setConfirmed(true);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setSubmitting(true);
    const res = await fetch(`/api/confirm/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy }),
    });
    const result = await res.json();
    if (result.success) setConfirmed(true);
    else setError(result.error);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('confirm.loading')}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="pt-6 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <div className="absolute right-4 top-4">
          <LanguageToggle />
        </div>
        <Card className="max-w-md rounded-3xl text-center shadow-soft">
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
            <h1 className="text-xl font-bold">{t('confirm.confirmedTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{data?.requestNo}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-lg rounded-3xl shadow-soft">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('confirm.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {interpolate(t('confirm.orderNoLabel'), { orderNo: data?.requestNo ?? '' })}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">{t('confirm.customer')}</p>
            <p className="font-semibold">{data?.customer}</p>
            {data?.driver && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{data.driver}</span>
              </div>
            )}
            {data?.truck && (
              <div className="flex items-center gap-2 text-sm">
                <AppLogo size="sm" />
                <span>{data.truck}</span>
              </div>
            )}
            {data?.arrivedAt && (
              <p className="text-xs text-muted-foreground">
                {t('confirm.arrivedAt')}: {formatDate(data.arrivedAt)}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">{t('confirm.products')}</p>
            <div className="space-y-2">
              {data?.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span>
                    {item.product.name} ({item.product.sku})
                  </span>
                  <span className="text-muted-foreground">
                    ×{item.quantity} — {item.totalWeight}kg
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('confirm.yourName')}</Label>
            <Input
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder={t('confirm.namePlaceholder')}
              required
            />
          </div>

          <Button
            className="h-14 w-full rounded-2xl text-lg"
            disabled={!approvedBy || submitting}
            onClick={handleApprove}
          >
            {submitting ? t('confirm.submitting') : t('confirm.approveDelivery')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
