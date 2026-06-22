'use client';

import { CancelAssignmentButton } from '@/components/yokomochi/CancelAssignmentButton';
import { useTranslation } from '@/lib/i18n/context';

type Schedule = {
  id: string;
  tripId: string;
  driverTaskStatus?: string | null;
  label: string | null;
  driver: { name: string };
  truck: { truckNo: string | null; truckNumber: string } | null;
  trip: { tripCode: string };
};

export function InternalFleetPendingAssignments({ schedules }: { schedules: Schedule[] }) {
  const { t } = useTranslation();
  const pending = schedules.filter((s) => s.driverTaskStatus === 'ASSIGNED');

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="mb-3 text-sm font-semibold">{t('assignment.pendingAcceptance')}</p>
      <p className="mb-3 text-xs text-muted-foreground">{t('assignment.pendingAcceptanceHint')}</p>
      <ul className="space-y-2">
        {pending.map((schedule) => (
          <li
            key={schedule.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{schedule.trip.tripCode}</p>
              <p className="text-xs text-muted-foreground">
                {schedule.driver.name} · {schedule.truck?.truckNo ?? schedule.truck?.truckNumber ?? '—'}
              </p>
            </div>
            <CancelAssignmentButton tripId={schedule.tripId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
