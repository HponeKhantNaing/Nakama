'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { QRModal } from './QRModal';

export function CustomerQRCard({
  requestId,
  requestNo,
  assignmentId,
  confirmed,
  expiresAt,
  canGenerate,
}: {
  requestId: string;
  requestNo: string;
  assignmentId: string | null;
  confirmed: boolean;
  expiresAt: Date | null;
  canGenerate: boolean;
}) {
  const { t, formatDate } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const statusKey = confirmed ? 'CONFIRMED' : 'WAITING';
  const statusLabel = confirmed ? t('driver.statusConfirmed') : t('driver.statusWaiting');
  const statusTone = confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';

  useEffect(() => {
    fetch(`/api/delivery/${requestId}/qr`)
      .then((r) => r.json())
      .then(() => {})
      .catch(() => {});
  }, [requestId]);

  const hint = useMemo(() => {
    if (confirmed) return t('delivery.customerConfirmed');
    if (!canGenerate) return t('driver.qrHint');
    return t('delivery.askCustomerScan');
  }, [confirmed, canGenerate, t]);

  function generateQr() {
    setError(null);
    startTransition(async () => {
      try {
        const url = assignmentId
          ? `/api/delivery/${requestId}/qr?assignmentId=${assignmentId}`
          : `/api/delivery/${requestId}/qr`;
        const res = await fetch(url, { method: 'POST' });
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) {
          setError(t('delivery.qrGenerateFailed'));
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t('delivery.qrGenerateFailed'));
          return;
        }
        setQrDataUrl(data.qrDataUrl ?? null);
        setOpen(true);
      } catch {
        setError(t('delivery.qrGenerateFailed'));
      }
    });
  }

  return (
    <Card className="rounded-xl border-primary/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('delivery.customerConfirmation')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <Badge className={cn('w-fit rounded-lg border-0 px-3 py-1', statusTone)}>{statusLabel}</Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-12 w-full rounded-xl text-base sm:w-auto"
            disabled={isPending || !canGenerate}
            onClick={generateQr}
          >
            {isPending ? t('delivery.generatingQr') : t('delivery.showCustomerQr')}
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto"
            disabled={!qrDataUrl}
            onClick={() => setOpen(true)}
          >
            {t('driver.fullScreenQr')}
          </Button>
        </div>

        {expiresAt && !confirmed && (
          <p className="text-[11px] text-muted-foreground">
            {interpolate(t('driver.expires'), { time: formatDate(expiresAt) })}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <QRModal
        open={open}
        onOpenChange={setOpen}
        requestNo={requestNo}
        qrDataUrl={qrDataUrl}
        status={statusKey}
      />
    </Card>
  );
}
