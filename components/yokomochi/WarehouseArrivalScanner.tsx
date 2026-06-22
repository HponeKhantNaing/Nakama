'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyYokomochiArrivalFromScan } from '@/app/actions/yokomochi';
import { normalizeTripScanInput } from '@/lib/yokomochi/trip-scan';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations/en';
import { interpolate } from '@/lib/i18n';
import { Camera, CheckCircle2, ChevronDown, ScanLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function cameraErrorMessage(
  error: unknown,
  t: (key: TranslationKey) => string
): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return t('scan.cameraPermissionDenied');
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return t('scan.cameraNotFound');
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return t('scan.cameraInUse');
    }
  }
  return t('scan.cameraFailed');
}

function formatSuccessLabel(tripCode: string | undefined, raw: string, t: (key: TranslationKey) => string) {
  const code = tripCode || normalizeTripScanInput(raw);
  if (code && /^YM-/i.test(code)) {
    return interpolate(t('scan.approvedTrip'), { tripCode: code });
  }
  return t('scan.approvedGeneric');
}

export function WarehouseArrivalScanner({
  onVerified,
}: {
  onVerified?: () => void;
}) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [qrBoxSize, setQrBoxSize] = useState(240);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const scanLockRef = useRef(false);
  const readerId = 'warehouse-qr-reader';

  useEffect(() => {
    function updateBox() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 360;
      setQrBoxSize(Math.min(280, Math.max(180, Math.floor(w * 0.72))));
    }
    updateBox();
    window.addEventListener('resize', updateBox);
    return () => window.removeEventListener('resize', updateBox);
  }, []);

  const processScan = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || scanLockRef.current) return;
      scanLockRef.current = true;
      setCode('');
      setError('');
      setSuccess('');

      startTransition(async () => {
        try {
          const result = await verifyYokomochiArrivalFromScan(trimmed);
          if (!result.success) {
            setError(result.error ?? t('scan.verificationFailed'));
            scanLockRef.current = false;
            return;
          }
          setSuccess(formatSuccessLabel(result.tripCode, trimmed, t));
          onVerified?.();
        } finally {
          setTimeout(() => {
            scanLockRef.current = false;
          }, 2000);
        }
      });
    },
    [onVerified, startTransition, t]
  );

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setCameraOpen(false);
      return;
    }
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // camera may already be stopped
    }
    setCameraOpen(false);
  }, []);

  async function handleOpenCamera() {
    setCameraError('');
    setError('');
    setSuccess('');

    if (!window.isSecureContext) {
      setCameraError(t('scan.cameraRequiresHttps'));
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('scan.cameraUnsupported'));
      return;
    }

    setRequestingPermission(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraOpen(true);
    } catch (e) {
      console.error(e);
      setCameraError(cameraErrorMessage(e, t));
      setCameraOpen(false);
    } finally {
      setRequestingPermission(false);
    }
  }

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;

    async function startScanner() {
      setCameraError('');
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: qrBoxSize, height: qrBoxSize } },
          (decoded) => {
            void stopCamera();
            processScan(decoded);
          },
          () => {
            // ignore per-frame scan misses
          }
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setCameraError(cameraErrorMessage(e, t));
          setCameraOpen(false);
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [cameraOpen, processScan, stopCamera, t, qrBoxSize]);

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20 shadow-sm">
      <CardHeader className="space-y-1.5 px-4 pb-2 pt-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
          <ScanLine className="h-5 w-5 shrink-0 text-primary" />
          <span className="leading-snug">{t('delivery.scanArrivalTitle')}</span>
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {t('delivery.scanArrivalDescMobile')}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">
        {success && (
          <div
            className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-green-900"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <p className="text-sm font-medium leading-snug">{success}</p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!cameraOpen ? (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl text-base font-semibold shadow-sm"
            onClick={() => void handleOpenCamera()}
            disabled={isPending || requestingPermission}
          >
            <Camera className="mr-2 h-5 w-5" />
            {requestingPermission ? t('scan.requestingCamera') : t('scan.openCamera')}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="warehouse-qr-reader overflow-hidden rounded-xl border-2 border-primary/30 bg-black">
              <div id={readerId} className="w-full [&_video]:!h-auto [&_video]:!max-h-[min(70vw,360px)] [&_video]:!w-full [&_video]:!object-cover" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => void stopCamera()}
            >
              <X className="mr-2 h-4 w-4" />
              {t('scan.closeCamera')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('scan.pointAtDriverQr')}</p>
          </div>
        )}

        {cameraError && (
          <p className="text-sm leading-relaxed text-destructive">{cameraError}</p>
        )}

        {!cameraOpen && (
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {t('scan.cameraPermissionHint')}
          </p>
        )}

        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium"
            onClick={() => setManualOpen((open) => !open)}
            aria-expanded={manualOpen}
          >
            <span>{t('scan.manualFallback')}</span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', manualOpen && 'rotate-180')}
            />
          </button>
          {manualOpen && (
            <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
              <Label htmlFor="trip-scan" className="text-xs text-muted-foreground">
                {t('carrier.tripCode')}
              </Label>
              <Input
                id="trip-scan"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processScan(code);
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted) {
                    e.preventDefault();
                    processScan(pasted);
                  }
                }}
                placeholder={t('scan.tripPlaceholder')}
                className="font-mono text-sm"
                autoComplete="off"
                inputMode="text"
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-lg"
                disabled={isPending || !code.trim()}
                onClick={() => processScan(code)}
              >
                {t('delivery.lookup')}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
