'use client';

import { cn } from '@/lib/utils';
import {
  DRIVER_TASK_STEPS,
  getDeliveryTrackingStepIndex,
} from '@/lib/yokomochi/delivery-status';
import { useTranslation } from '@/lib/i18n/context';
import { Check } from 'lucide-react';

type DeliveryStepProgressBarProps = {
  status: string;
  verificationStatus?: string | null;
  bulletNumber?: number | null;
};

export function DeliveryStepProgressBar({
  status,
  verificationStatus,
  bulletNumber,
}: DeliveryStepProgressBarProps) {
  const { t } = useTranslation();
  const currentIndex = getDeliveryTrackingStepIndex(status, verificationStatus);
  const isFullyComplete =
    status === 'COMPLETED' || verificationStatus === 'APPROVED' || status === 'CANCELLED';
  const labels = [
    t('delivery.stepAssigned'),
    t('delivery.stepArrivedFactory'),
    t('delivery.stepLoaded'),
    t('delivery.stepInTransit'),
    t('delivery.stepArrivedWarehouse'),
    t('delivery.stepCompleted'),
  ];

  return (
    <div className="flex w-full min-w-0 max-w-full items-start gap-2">
      {bulletNumber != null && (
        <span
          className="w-6 shrink-0 text-right text-sm font-bold tabular-nums leading-relaxed text-foreground"
          aria-label={`Trip ${bulletNumber}`}
        >
          {bulletNumber}.
        </span>
      )}
      <div
        className="grid min-w-0 flex-1 grid-cols-6 gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={DRIVER_TASK_STEPS.length - 1}
        aria-valuenow={currentIndex}
      >
        {DRIVER_TASK_STEPS.map((step, index) => {
          const done =
            !isFullyComplete && index < currentIndex && status !== 'CANCELLED';
          const complete =
            isFullyComplete && index <= currentIndex && status !== 'CANCELLED';
          const active =
            !isFullyComplete && index === currentIndex && status !== 'CANCELLED';
          const awaitingWarehouse =
            !isFullyComplete &&
            status === 'ARRIVED_WAREHOUSE' &&
            verificationStatus !== 'APPROVED' &&
            index === DRIVER_TASK_STEPS.indexOf('ARRIVED_WAREHOUSE');

          return (
            <div key={step} className="flex min-w-0 flex-col items-center gap-1">
              <div
                className={cn(
                  'relative h-2.5 w-full min-w-0 rounded-full transition-colors',
                  complete && 'bg-emerald-500',
                  done && 'bg-primary',
                  active && !awaitingWarehouse && 'bg-primary shadow-sm',
                  active && !awaitingWarehouse && 'ring-2 ring-primary/50 ring-offset-1',
                  awaitingWarehouse && 'bg-amber-400 ring-2 ring-amber-300/60 ring-offset-1',
                  !done && !complete && !active && !awaitingWarehouse && 'bg-muted'
                )}
                title={labels[index]}
              >
                {complete && index === DRIVER_TASK_STEPS.length - 1 && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-2 w-2 text-white" strokeWidth={4} />
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'hidden w-full truncate text-center text-[9px] leading-none sm:block',
                  (complete || done || active) && 'font-medium text-foreground',
                  !complete && !done && !active && 'text-muted-foreground'
                )}
              >
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
