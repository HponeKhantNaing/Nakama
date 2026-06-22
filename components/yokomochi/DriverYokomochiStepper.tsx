'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DRIVER_TASK_STEPS,
  getDriverTaskStepIndex,
} from '@/lib/yokomochi/delivery-status';
import { useTranslation } from '@/lib/i18n/context';

const STEP_LABEL_KEYS = [
  'delivery.stepAssigned',
  'delivery.stepArrivedFactory',
  'delivery.stepLoaded',
  'delivery.stepInTransit',
  'delivery.stepArrivedWarehouse',
  'delivery.stepCompleted',
] as const;

export function DriverYokomochiStepper({ status }: { status: string }) {
  const { t } = useTranslation();
  const isComplete = status === 'COMPLETED';
  const isCancelled = status === 'CANCELLED';
  const stepIndex = getDriverTaskStepIndex(status);
  const currentIndex = isComplete ? DRIVER_TASK_STEPS.length : stepIndex;

  return (
    <ol className="space-y-0" aria-label={t('delivery.progress')}>
      {DRIVER_TASK_STEPS.map((step, index) => {
        const done = !isCancelled && (index < currentIndex || isComplete);
        const active = !isCancelled && !isComplete && index === stepIndex;
        const upcoming = !done && !active;
        const isLast = index === DRIVER_TASK_STEPS.length - 1;

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                  done && isComplete && isLast && 'border-emerald-500 bg-emerald-500 text-white',
                  done && !(isComplete && isLast) && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-primary/10 text-primary ring-4 ring-primary/15',
                  upcoming && 'border-muted-foreground/25 bg-muted/30 text-muted-foreground'
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'my-1 min-h-[20px] w-0.5 flex-1 rounded-full',
                    done ? (isComplete ? 'bg-emerald-500' : 'bg-primary') : 'bg-border'
                  )}
                />
              )}
            </div>
            <div className={cn('pb-5 pt-1', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-semibold leading-tight',
                  active && 'text-primary',
                  done && isComplete && isLast && 'text-emerald-700',
                  done && !(isComplete && isLast) && 'text-foreground',
                  upcoming && 'text-muted-foreground'
                )}
              >
                {t(STEP_LABEL_KEYS[index])}
              </p>
              {active && status === 'ARRIVED_WAREHOUSE' && (
                <p className="mt-1 text-xs text-amber-700">{t('yokomochiDriver.awaitingScan')}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
