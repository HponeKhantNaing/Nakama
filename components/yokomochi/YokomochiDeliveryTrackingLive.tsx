'use client';

import { useCallback, useEffect, useState } from 'react';
import { getYokomochiDeliveryTracking } from '@/app/actions/yokomochi';
import {
  YokomochiDeliveryTrackingTable,
  type YokomochiDeliveryTrackingRow,
} from '@/components/yokomochi/YokomochiDeliveryTrackingTable';

const POLL_MS = 4000;

export function YokomochiDeliveryTrackingLive({
  initialRows,
  onRowsUpdated,
  refreshNonce = 0,
}: {
  initialRows: YokomochiDeliveryTrackingRow[];
  onRowsUpdated?: (rows: YokomochiDeliveryTrackingRow[]) => void;
  refreshNonce?: number;
}) {
  const [rows, setRows] = useState(initialRows);

  const refresh = useCallback(async () => {
    try {
      const next = await getYokomochiDeliveryTracking();
      setRows(next);
      onRowsUpdated?.(next);
    } catch {
      /* keep last good snapshot */
    }
  }, [onRowsUpdated]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    void refresh();
  }, [refreshNonce, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return <YokomochiDeliveryTrackingTable rows={rows} />;
}
