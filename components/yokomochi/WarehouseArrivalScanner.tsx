'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  lookupYokomochiArrival,
  verifyYokomochiArrivalByTripCode,
} from '@/app/actions/yokomochi';
import { normalizeTripScanInput } from '@/lib/yokomochi/trip-scan';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { ScanLine, CheckCircle2 } from 'lucide-react';

type ArrivalInfo = NonNullable<Awaited<ReturnType<typeof lookupYokomochiArrival>>>;

export function WarehouseArrivalScanner({
  onVerified,
}: {
  onVerified?: () => void;
}) {
  const { t, formatDate, statusLabel } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function scan(value: string) {
    const trimmed = normalizeTripScanInput(value);
    if (!trimmed) return;
    setCode(trimmed);
    setError('');
    setSuccess('');
    startTransition(async () => {
      const result = await lookupYokomochiArrival(trimmed);
      if (!result) {
        setArrival(null);
        setConfirmOpen(false);
        setError(t('scan.tripNotFound'));
        return;
      }

      if (result.taskStatus === 'COMPLETED') {
        setArrival(result);
        setConfirmOpen(false);
        setSuccess(`${result.tripCode} — ${t('delivery.alreadyApproved')}`);
        return;
      }

      const ready =
        result.taskStatus === 'ARRIVED_WAREHOUSE' || result.tripStatus === 'ARRIVED_WAREHOUSE';

      if (!ready) {
        setArrival(result);
        setConfirmOpen(false);
        setError(
          interpolate(t('scan.notReady'), {
            status: statusLabel(result.taskStatus),
          })
        );
        return;
      }

      setArrival(result);
      setConfirmOpen(true);
    });
  }

  function confirmArrival() {
    if (!arrival) return;
    setError('');
    setSuccess('');
    startTransition(async () => {
      const result = await verifyYokomochiArrivalByTripCode(arrival.tripCode, true);
      if (!result.success) {
        setError(result.error ?? t('scan.verificationFailed'));
        return;
      }
      setCode('');
      setArrival(null);
      setConfirmOpen(false);
      setSuccess(`${arrival.tripCode} — ${t('delivery.approveArrival')} ✓`);
      onVerified?.();
    });
  }

  return (
    <>
      <Card className="rounded-2xl border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-primary" />
            {t('delivery.scanArrivalTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('delivery.scanArrivalDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-scan">{t('carrier.tripCode')}</Label>
            <div className="flex gap-2">
              <Input
                id="trip-scan"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    scan(code);
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted) {
                    e.preventDefault();
                    scan(pasted);
                  }
                }}
                placeholder={t('scan.tripPlaceholder')}
                className="font-mono"
                autoComplete="off"
                autoFocus
              />
              <Button type="button" variant="outline" disabled={isPending} onClick={() => scan(code)}>
                {t('delivery.lookup')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('delivery.scanHint')}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </p>
          )}

          {arrival && arrival.taskStatus !== 'COMPLETED' && !confirmOpen && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{arrival.orderNo}</p>
                  <p className="text-lg font-semibold">{arrival.tripCode}</p>
                </div>
                <Badge variant="outline">{statusLabel(arrival.taskStatus)}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('delivery.confirmArrivalTitle')}</DialogTitle>
            <DialogDescription>{t('delivery.confirmArrivalDesc')}</DialogDescription>
          </DialogHeader>
          {arrival && (
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs text-muted-foreground">{arrival.orderNo}</p>
              <p className="text-lg font-semibold">{arrival.tripCode}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">{t('scan.factory')}:</span> {arrival.factoryName}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('scan.driver')}:</span> {arrival.driverName}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('scan.cargo')}:</span> {arrival.cargoType ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('scan.qty')}:</span>{' '}
                  {interpolate(t('scan.qtyDetail'), {
                    boxes: arrival.boxes,
                    pallets: arrival.pallets,
                  })}
                </p>
                {arrival.arrivedWarehouseAt && (
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">{t('scan.arrived')}:</span>{' '}
                    {formatDate(arrival.arrivedWarehouseAt)}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={isPending} onClick={confirmArrival}>
              {t('delivery.confirmArrival')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
