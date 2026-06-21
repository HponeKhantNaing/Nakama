'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/context';

export function YokomochiWarehouseQRCard({
  taskId,
  tripCode,
  orderNo,
  totalTrips,
  tripNo,
}: {
  taskId: string;
  tripCode: string;
  orderNo: string;
  totalTrips: number;
  tripNo: number;
}) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/yokomochi/trip/${taskId}/qr`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t('delivery.qrGenerateFailed'));
          setQrDataUrl(null);
          setScanUrl(null);
          return;
        }
        setError(null);
        setQrDataUrl(data.qrDataUrl ?? null);
        setScanUrl(data.url ?? null);
      } catch {
        setError(t('delivery.qrGenerateFailed'));
        setQrDataUrl(null);
        setScanUrl(null);
      }
    });
  }, [taskId, t]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 p-4 text-center">
        <p className="text-sm font-semibold">{t('yokomochi.warehouseQrTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('yokomochi.warehouseQrHint')}</p>
        {totalTrips > 1 && (
          <p className="text-xs font-medium text-primary">
            {t('yokomochi.warehouseQrTrip')} {tripNo} / {totalTrips}
          </p>
        )}
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR ${tripCode}`}
            className="mx-auto rounded-lg border bg-white p-2"
          />
        ) : (
          <div className="mx-auto h-[200px] w-[200px] animate-pulse rounded-lg bg-muted" />
        )}
        <p className="font-mono text-sm font-bold">{tripCode}</p>
        {isPending && !qrDataUrl && !error && (
          <p className="text-xs text-muted-foreground">{t('delivery.generatingQr')}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {scanUrl &&
          (scanUrl.includes('localhost') || scanUrl.includes('127.0.0.1')) && (
            <p className="text-xs text-amber-700">{t('yokomochi.warehouseQrLocalhostHint')}</p>
          )}
        {scanUrl && !scanUrl.includes('localhost') && !scanUrl.includes('127.0.0.1') && (
          <p className="text-xs text-muted-foreground">{t('yokomochi.warehouseQrPhoneHint')}</p>
        )}
        {scanUrl && (
          <a
            href={scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-xs text-primary underline underline-offset-2"
          >
            {t('yokomochi.warehouseQrOpenLink')}
          </a>
        )}
        <p className="sr-only">{orderNo}</p>
      </CardContent>
    </Card>
  );
}
