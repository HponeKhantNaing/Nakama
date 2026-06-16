'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTransportRequest } from '@/app/actions/transport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VehicleType } from '@prisma/client';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import { Plus } from 'lucide-react';

export function TransportRequestForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await createTransportRequest(formData);
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error ?? t('form.submitError'));
      }
    });
  }

  function vehicleLabel(type: string) {
    const key = `vehicle.${type}` as TranslationKey;
    const translated = t(key);
    return translated === key ? type.replace(/_/g, ' ') : translated;
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
        <form action={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin">{t('form.origin')}</Label>
            <Input id="origin" name="origin" placeholder={t('form.originPlaceholder')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">{t('form.destination')}</Label>
            <Input
              id="destination"
              name="destination"
              placeholder={t('form.destinationPlaceholder')}
              required
            />
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
            <Label htmlFor="cargoWeight">{t('form.cargoWeight')}</Label>
            <Input id="cargoWeight" name="cargoWeight" type="number" step="0.1" min="0.1" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleType">{t('form.vehicleType')}</Label>
            <Select id="vehicleType" name="vehicleType" required>
              {Object.values(VehicleType).map((type) => (
                <option key={type} value={type}>
                  {vehicleLabel(type)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleCount">{t('form.vehicleCount')}</Label>
            <Input
              id="vehicleCount"
              name="vehicleCount"
              type="number"
              min="1"
              max="10"
              defaultValue="1"
              required
            />
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
