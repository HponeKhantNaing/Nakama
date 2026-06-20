'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/context';

export function YokomochiWarehouseQRCard({ tripCode, orderNo }: { tripCode: string; orderNo: string }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(tripCode, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [tripCode]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 p-4 text-center">
        <p className="text-sm font-semibold">{t('yokomochi.warehouseQrTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('yokomochi.warehouseQrHint')}</p>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={`QR ${tripCode}`} className="mx-auto rounded-lg border bg-white p-2" />
        ) : (
          <div className="mx-auto h-[200px] w-[200px] animate-pulse rounded-lg bg-muted" />
        )}
        <p className="font-mono text-sm font-bold">{tripCode}</p>
        <p className="sr-only">{orderNo}</p>
      </CardContent>
    </Card>
  );
}
