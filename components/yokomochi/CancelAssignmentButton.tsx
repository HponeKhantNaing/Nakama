'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cancelYokomochiDriverAssignment } from '@/app/actions/yokomochi';
import { useTranslation } from '@/lib/i18n/context';

export function CancelAssignmentButton({
  tripId,
  size = 'sm',
  variant = 'outline',
}: {
  tripId: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'destructive';
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(t('assignment.cancelConfirm'))) return;
        startTransition(async () => {
          const result = await cancelYokomochiDriverAssignment(tripId);
          if (!result.success) {
            alert(result.error ?? t('assignment.cancelFailed'));
            return;
          }
          router.refresh();
        });
      }}
    >
      {t('assignment.cancel')}
    </Button>
  );
}
