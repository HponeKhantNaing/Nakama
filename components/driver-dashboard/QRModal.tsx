'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

export function QRModal({
  open,
  onOpenChange,
  requestNo,
  qrDataUrl,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestNo: string;
  qrDataUrl: string | null;
  status: 'WAITING' | 'CONFIRMED';
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{interpolate(t('qrModal.title'), { requestNo })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <p className="text-sm font-semibold">
              {status === 'CONFIRMED' ? `✓ ${t('qrModal.confirmed')}` : t('qrModal.waiting')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('qrModal.hint')}</p>
          </div>

          {qrDataUrl ? (
            <div className="flex flex-col items-center rounded-xl border bg-white p-4 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={t('qrModal.alt')} className="aspect-square w-full max-w-64" />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('qrModal.notGenerated')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
