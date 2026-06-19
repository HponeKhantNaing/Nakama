'use client';

import { cn } from '@/lib/utils';
import {
  DRIVER_TASK_STEPS,
  getDeliveryTrackingStepIndex,
} from '@/lib/yokomochi/delivery-status';
import { useTranslation } from '@/lib/i18n/context';

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
        className="grid min-w-0 flex-1 grid-cols-6 gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={DRIVER_TASK_STEPS.length - 1}
        aria-valuenow={currentIndex}
      >
        {DRIVER_TASK_STEPS.map((step, index) => {
          const done = index <= currentIndex && status !== 'CANCELLED';
          const active = index === currentIndex;
          const awaitingWarehouse =
            status === 'ARRIVED_WAREHOUSE' &&
            verificationStatus !== 'APPROVED' &&
            index === DRIVER_TASK_STEPS.indexOf('ARRIVED_WAREHOUSE');

          return (
            <div
              key={step}
              className={cn(
                'h-2 min-w-0 shrink-0 rounded-full',
                done ? 'bg-primary' : 'bg-muted',
                active && 'ring-2 ring-primary/40',
                awaitingWarehouse && 'bg-amber-400'
              )}
              title={labels[index]}
            />
          );
        })}
      </div>
    </div>
  );
}
