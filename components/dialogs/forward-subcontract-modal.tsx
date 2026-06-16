'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { forwardToSubcontractor } from '@/app/actions/transport';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n/context';

type Subcontractor = { id: string; name: string };

interface ForwardSubcontractModalProps {
  requestId: string;
  subcontractors: Subcontractor[];
}

export function ForwardSubcontractModal({
  requestId,
  subcontractors,
}: ForwardSubcontractModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('requestId', requestId);
    startTransition(async () => {
      const result = await forwardToSubcontractor(formData);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? t('error.forwardOrder'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('shinwa.forwardSubcontractor')}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('shinwa.forwardTitle')}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subcontractorId">{t('shinwa.selectSubcontractor')}</Label>
            <Select id="subcontractorId" name="subcontractorId" required>
              <option value="">{t('shinwa.selectSubcontractor')}</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t('shinwa.forwardNotes')}</Label>
            <Input id="notes" name="notes" placeholder={t('form.notesPlaceholder')} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t('shinwa.forwarding') : t('shinwa.forwardOrder')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
