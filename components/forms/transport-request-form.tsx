'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTransportRequest } from '@/app/actions/transport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/context';
import {
  WAREHOUSE_LOCATIONS,
  DESTINATION_LOCATIONS,
  DEFAULT_BOX_WEIGHT_KG,
} from '@/lib/tms/locations';
import { Plus } from 'lucide-react';

export function TransportRequestForm() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [boxCount, setBoxCount] = useState(1);
  const [formKey, setFormKey] = useState(0);

  const lang = locale === 'ja' ? 'ja' : 'en';

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await createTransportRequest(formData);
      if (result.success) {
        // Remount the form to clear uncontrolled inputs after submit.
        setSuccess(true);
        setBoxCount(1);
        setFormKey((k) => k + 1);
        router.refresh();
      } else {
        setError(result.error ?? t('form.submitError'));
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('form.createRequest')}</CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Plus className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <form key={formKey} action={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="originLocationId">{t('form.origin')}</Label>
            <Select id="originLocationId" name="originLocationId" required defaultValue="tokyo-wh">
              {WAREHOUSE_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {lang === 'ja' ? loc.labelJa : loc.labelEn}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinationLocationId">{t('form.destination')}</Label>
            <Select id="destinationLocationId" name="destinationLocationId" required>
              <option value="">{t('form.selectDestination')}</option>
              {DESTINATION_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {lang === 'ja' ? loc.labelJa : loc.labelEn}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargoType">{t('form.cargoType')}</Label>
            <Input
              id="cargoType"
              name="cargoType"
              placeholder={t('form.cargoTypePlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalBoxes">{t('form.totalBoxes')}</Label>
            <Input
              id="totalBoxes"
              name="totalBoxes"
              type="number"
              min="1"
              step="1"
              value={boxCount}
              onChange={(e) => setBoxCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('form.estimatedWeight')}: ~{boxCount * DEFAULT_BOX_WEIGHT_KG} kg —{' '}
              {t('form.carrierAssignsTrucks')}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expectedPickupDate">{t('form.expectedPickupDate')}</Label>
            <Input id="expectedPickupDate" name="expectedPickupDate" type="datetime-local" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">
              {t('form.notes')} ({t('common.optional')})
            </Label>
            <Input id="notes" name="notes" placeholder={t('form.notesPlaceholder')} />
          </div>
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          {success && (
            <p className="text-sm font-medium text-emerald-600 md:col-span-2">{t('form.submitSuccess')}</p>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={isPending} className="w-full md:w-auto">
              {isPending ? t('form.submitting') : t('form.submitRequest')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
