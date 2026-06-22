'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  clampDateNotBeforeToday,
  getTodayDateString,
  isDateBeforeReference,
  isDateBeforeToday,
} from '@/lib/yokomochi/date-picker-rules';
import { useTranslation } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  referenceDate?: string;
  referenceLabel?: string;
};

export function ScheduleDateInput({
  id,
  label,
  value,
  onChange,
  disabled,
  referenceDate,
  referenceLabel,
}: Props) {
  const { t } = useTranslation();
  const today = getTodayDateString();
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  function applyDate(next: string) {
    if (!next || isDateBeforeToday(next)) return;
    onChange(next);
  }

  function handleChange(next: string) {
    if (!next) {
      onChange('');
      return;
    }
    if (isDateBeforeToday(next)) return;

    if (
      referenceDate &&
      isDateBeforeReference(next, referenceDate) &&
      next !== value
    ) {
      setPendingDate(next);
      return;
    }

    applyDate(next);
  }

  return (
    <>
      <div>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="date"
          min={today}
          value={value}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>

      <Dialog open={!!pendingDate} onOpenChange={(open) => !open && setPendingDate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('datePicker.earlierDateTitle')}</DialogTitle>
            <DialogDescription>
              {interpolate(t('datePicker.earlierDateDesc'), {
                selected: pendingDate ?? '',
                reference: referenceDate ?? '',
                referenceLabel: referenceLabel ?? t('datePicker.requestedDelivery'),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingDate(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (pendingDate) {
                  applyDate(clampDateNotBeforeToday(pendingDate));
                }
                setPendingDate(null);
              }}
            >
              {t('datePicker.confirmEarlierDate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
