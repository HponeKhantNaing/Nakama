'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Customer QR — {requestNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <p className="text-sm font-semibold">
              {status === 'CONFIRMED' ? '✓ Customer Confirmed' : 'Waiting for customer scan'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please ask customer to scan to confirm delivery.
            </p>
          </div>

          {qrDataUrl ? (
            <div className="flex flex-col items-center rounded-xl border bg-white p-4 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Delivery QR" className="aspect-square w-full max-w-64" />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              QR is not generated yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

