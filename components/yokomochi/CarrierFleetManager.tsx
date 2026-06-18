'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TruckType, LicenseType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createCarrierDriver, createCarrierTruck } from '@/app/actions/carrier-fleet';
import { getYokomochiVehicleLabel } from '@/lib/yokomochi/vehicle-capacity';
import { useTranslation } from '@/lib/i18n/context';

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  licenseType: LicenseType;
  isAvailable: boolean;
  status: string;
  user?: { email: string } | null;
};

type Truck = {
  id: string;
  truckNumber: string;
  truckNo: string | null;
  plateNumber: string;
  truckType: TruckType;
  maxBoxes: number;
  maxPallet: number;
  capacityWeightKg: number;
  status: string;
};

export function CarrierFleetManager({
  drivers,
  trucks,
}: {
  drivers: Driver[];
  trucks: Truck[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [driverError, setDriverError] = useState('');
  const [truckError, setTruckError] = useState('');
  const [driverSuccess, setDriverSuccess] = useState('');
  const [truckSuccess, setTruckSuccess] = useState('');

  function addDriver(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setDriverError('');
    setDriverSuccess('');
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createCarrierDriver({
        name: String(fd.get('name')),
        email: String(fd.get('email')),
        password: String(fd.get('password')),
        phone: String(fd.get('phone') || ''),
        licenseNo: String(fd.get('licenseNo') || ''),
        licenseType: fd.get('licenseType') as LicenseType,
      });
      if (!result.success) {
        setDriverError(result.error ?? 'Failed');
        return;
      }
      setDriverSuccess(t('carrier.driverAdded'));
      form.reset();
      router.refresh();
    });
  }

  function addTruck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setTruckError('');
    setTruckSuccess('');
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createCarrierTruck({
        truckNumber: String(fd.get('truckNumber')),
        truckNo: String(fd.get('truckNo') || ''),
        plateNumber: String(fd.get('plateNumber')),
        truckType: fd.get('truckType') as TruckType,
        capacityWeightKg: Number(fd.get('capacityWeightKg') || 0) || undefined,
        capacityVolumeM3: Number(fd.get('capacityVolumeM3') || 0) || undefined,
      });
      if (!result.success) {
        setTruckError(result.error ?? 'Failed');
        return;
      }
      setTruckSuccess(t('carrier.vehicleAdded'));
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">{t('carrier.addDriver')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addDriver} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="driver-name">{t('carrier.driverName')} *</Label>
              <Input id="driver-name" name="name" required placeholder="山田 太郎" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driver-email">{t('carrier.email')} *</Label>
              <Input
                id="driver-email"
                name="email"
                type="email"
                required
                placeholder="driver@shinwa.jp"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driver-password">{t('carrier.password')} *</Label>
              <Input
                id="driver-password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driver-phone">{t('carrier.phone')}</Label>
              <Input id="driver-phone" name="phone" placeholder="+81-90-1234-5678" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driver-license">{t('carrier.licenseNo')}</Label>
              <Input id="driver-license" name="licenseNo" placeholder="DL-123456" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driver-license-type">{t('carrier.licenseType')}</Label>
              <select
                id="driver-license-type"
                name="licenseType"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                defaultValue={LicenseType.STANDARD}
              >
                {Object.values(LicenseType).map((lt) => (
                  <option key={lt} value={lt}>
                    {lt}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {t('carrier.registerDriver')}
            </Button>
          </form>
          {driverError && <p className="text-sm text-destructive">{driverError}</p>}
          {driverSuccess && <p className="text-sm text-green-600">{driverSuccess}</p>}

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">{t('carrier.registeredDrivers')}</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('carrier.noDrivers')}</p>
              ) : (
                drivers.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"
                  >
                    <div>
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.user?.email ?? '—'}
                        {d.phone ? ` · ${d.phone}` : ''} · {d.licenseType}
                        {d.licenseNo ? ` · ${d.licenseNo}` : ''}
                      </p>
                    </div>
                    <Badge variant={d.isAvailable ? 'default' : 'secondary'}>
                      {d.isAvailable ? t('common.available') : t('common.onTrip')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">{t('carrier.addVehicle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addTruck} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="truck-number">{t('carrier.truckNumber')} *</Label>
              <Input id="truck-number" name="truckNumber" required placeholder="SHINWA-10T-01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="truck-no">{t('carrier.truckNo')}</Label>
              <Input id="truck-no" name="truckNo" placeholder="10t-01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plate-number">{t('carrier.plateNumber')} *</Label>
              <Input id="plate-number" name="plateNumber" required placeholder="品川500あ1234" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="truck-type">{t('carrier.vehicleType')} *</Label>
              <select
                id="truck-type"
                name="truckType"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                defaultValue={TruckType.TEN_TON}
              >
                <option value={TruckType.TEN_TON}>
                  {getYokomochiVehicleLabel(TruckType.TEN_TON)} — 96 boxes
                </option>
                <option value={TruckType.MEDIUM}>
                  {getYokomochiVehicleLabel(TruckType.MEDIUM)} — 36 boxes
                </option>
                <option value={TruckType.SMALL}>
                  {getYokomochiVehicleLabel(TruckType.SMALL)} — 5 boxes
                </option>
                <option value={TruckType.BANN}>
                  {getYokomochiVehicleLabel(TruckType.BANN)} — 5 boxes
                </option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="weight-kg">{t('carrier.capacityKg')}</Label>
                <Input id="weight-kg" name="capacityWeightKg" type="number" placeholder="10000" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="volume-m3">{t('carrier.capacityM3')}</Label>
                <Input id="volume-m3" name="capacityVolumeM3" type="number" step="0.1" placeholder="40" />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {t('carrier.registerVehicle')}
            </Button>
          </form>
          {truckError && <p className="text-sm text-destructive">{truckError}</p>}
          {truckSuccess && <p className="text-sm text-green-600">{truckSuccess}</p>}

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">{t('carrier.registeredVehicles')}</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {trucks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('carrier.noVehicles')}</p>
              ) : (
                trucks.map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"
                  >
                    <div>
                      <p className="font-semibold">{tr.truckNo ?? tr.truckNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {getYokomochiVehicleLabel(tr.truckType)} · {tr.plateNumber} · {tr.maxBoxes}{' '}
                        {t('carrier.boxes')}
                      </p>
                    </div>
                    <Badge variant={tr.status === 'AVAILABLE' ? 'default' : 'secondary'}>
                      {tr.status === 'AVAILABLE' ? t('common.available') : t('common.inUse')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
