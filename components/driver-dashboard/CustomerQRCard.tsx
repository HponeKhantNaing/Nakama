'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const status = confirmed ? 'CONFIRMED' : 'WAITING';
  const statusTone = confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';

  useEffect(() => {
    // Load existing QR if it exists (GET returns token/confirmation row)
    fetch(`/api/delivery/${requestId}/qr`)
      .then((r) => r.json())
      .then(() => {})
      .catch(() => {});
  }, [requestId]);

  const hint = useMemo(() => {
    if (confirmed) return 'Customer has confirmed delivery.';
    if (!canGenerate) return 'QR becomes available after Arrived.';
    return 'Ask customer to scan this QR to confirm.';
  }, [confirmed, canGenerate]);

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
          setError('Failed to generate QR');
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to generate QR');
          return;
        }
        setQrDataUrl(data.qrDataUrl ?? null);
        setOpen(true);
      } catch {
        setError('Failed to generate QR');
      }
    });
  }

  return (
    <Card className="rounded-3xl border-primary/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Customer Confirmation</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <Badge className={cn('rounded-xl border-0 px-3 py-1', statusTone)}>{status}</Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-12 rounded-2xl text-base"
            disabled={isPending || !canGenerate}
            onClick={generateQr}
          >
            {isPending ? 'Generating...' : 'Show Customer QR'}
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-2xl text-base"
            disabled={!qrDataUrl}
            onClick={() => setOpen(true)}
          >
            Full Screen QR
          </Button>
        </div>

        {expiresAt && !confirmed && (
          <p className="text-[11px] text-muted-foreground">
            Expires: {new Date(expiresAt).toLocaleString('ja-JP')}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <QRModal
        open={open}
        onOpenChange={setOpen}
        requestNo={requestNo}
        qrDataUrl={qrDataUrl}
        status={status}
      />
    </Card>
  );
}

