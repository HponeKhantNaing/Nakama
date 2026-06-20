'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';

type QrStatus = 'WAITING' | 'SCANNED' | 'APPROVED';

function resolveQrStatus(input: {
  hasConfirmation: boolean;
  approved: boolean;
}): QrStatus {
  if (input.approved) return 'APPROVED';
  if (input.hasConfirmation) return 'SCANNED';
  return 'WAITING';
}

export function CustomerConfirmationCard({
  driverName,
  truckNo,
  hasConfirmation,
  approved,
  approvedAt,
  approvedBy,
  expiresAt,
}: {
  driverName: string;
  truckNo: string | null;
  hasConfirmation: boolean;
  approved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  expiresAt: Date | null;
}) {
  const { t, formatDate } = useTranslation();
  const qrStatus = resolveQrStatus({ hasConfirmation, approved });
  const tone =
    qrStatus === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-700'
      : qrStatus === 'SCANNED'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-amber-50 text-amber-700';

  const qrLabel =
    qrStatus === 'APPROVED'
      ? t('customerConfirm.qrApproved')
      : qrStatus === 'SCANNED'
        ? t('customerConfirm.qrScanned')
        : t('customerConfirm.qrWaiting');

  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <p className="text-sm font-semibold">{driverName}</p>
          <p className="text-xs text-muted-foreground">
            {interpolate(t('customerConfirm.truck'), { no: truckNo ?? '—' })}
          </p>
        </div>
        <div className="text-right">
          <Badge className={cn('rounded-xl border-0 px-3 py-1', tone)}>
            {interpolate(t('customerConfirm.qr'), { status: qrLabel })}
          </Badge>
          {approved && approvedAt && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {interpolate(t('customerConfirm.confirmedAt'), {
                date: formatDate(approvedAt),
                by: approvedBy
                  ? interpolate(t('customerConfirm.confirmedBy'), { name: approvedBy })
                  : '',
              })}
            </p>
          )}
          {!approved && expiresAt && hasConfirmation && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {interpolate(t('customerConfirm.expiresAt'), { date: formatDate(expiresAt) })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
