'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, Truck, User } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

interface ConfirmData {
  orderNo: string;
  tripCode: string;
  tripNo: number;
  totalTrips: number;
  completedTrips: number;
  productName: string | null;
  factoryName: string;
  destination: string;
  driver: string;
  truck: string | null;
  cargoType: string | null;
  boxes: number;
  pallets: number;
  arrivedAt: string | null;
  alreadyConfirmed: boolean;
}

export default function YokomochiConfirmPage() {
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
    fetch(`/api/yokomochi/confirm/${token}`)
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
    const res = await fetch(`/api/yokomochi/confirm/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy }),
    });
    const result = await res.json();
    if (result.success) setConfirmed(true);
    else setError(result.error);
    setSubmitting(false);
  }

  const tripLeg =
    data && data.totalTrips > 1
      ? interpolate(t('yokomochiConfirm.tripLeg'), {
          current: data.completedTrips + 1,
          total: data.totalTrips,
        })
      : null;

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
            <h1 className="text-xl font-bold">{t('yokomochiConfirm.confirmedTitle')}</h1>
            <p className="mt-2 font-mono text-sm text-muted-foreground">{data?.tripCode}</p>
            {tripLeg && <p className="mt-1 text-xs text-muted-foreground">{tripLeg}</p>}
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
          <CardTitle>{t('yokomochiConfirm.title')}</CardTitle>
          <p className="font-mono text-sm text-muted-foreground">{data?.tripCode}</p>
          {tripLeg && (
            <Badge variant="outline" className="mx-auto mt-2">
              {tripLeg}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">{t('confirm.orderNo')}</p>
            <p className="font-semibold">{data?.orderNo}</p>
            {data?.productName && (
              <p className="text-sm text-muted-foreground">{data.productName}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('scan.factory')}</p>
            <p className="font-medium">{data?.factoryName}</p>
            <p className="text-xs text-muted-foreground">{t('yokomochiConfirm.destination')}</p>
            <p className="font-medium">{data?.destination}</p>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{data?.driver}</span>
            </div>
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

          <div className="rounded-xl border border-border/50 px-3 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {data?.cargoType ?? t('yokomochi.defaultCargo')}
            </div>
            <p className="mt-2 text-muted-foreground">
              {interpolate(t('scan.qtyDetail'), {
                boxes: data?.boxes ?? 0,
                pallets: data?.pallets ?? 0,
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('yokomochiConfirm.yourName')}</Label>
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
            {submitting ? t('confirm.submitting') : t('yokomochiConfirm.approve')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
