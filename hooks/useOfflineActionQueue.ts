/* eslint-disable no-console */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type QueuedAction =
  | { type: 'ASSIGNMENT_STATUS'; assignmentId: string; status: 'DISPATCHED' | 'PICKED_UP' | 'ARRIVED' | 'DELIVERED' }
  | { type: 'REQUEST_STATUS'; requestId: string; status: 'DISPATCHED' | 'PICKED_UP' | 'ARRIVED' | 'DELIVERED' };

const STORAGE_KEY = 'mtms.offlineQueue.v1';

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function useOfflineActionQueue({
  run,
}: {
  run: (a: QueuedAction) => Promise<boolean>;
}) {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  useEffect(() => {
    setQueue(loadQueue());
    setOnline(navigator.onLine);
  }, []);

  useEffect(() => saveQueue(queue), [queue]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const enqueue = useCallback((a: QueuedAction) => {
    setQueue((q) => [...q, a]);
  }, []);

  const sync = useCallback(async () => {
    if (!online) return;
    // sequential replay
    const current = loadQueue();
    if (current.length === 0) return;

    const remaining: QueuedAction[] = [];
    for (const a of current) {
      const ok = await run(a);
      if (!ok) remaining.push(a);
    }
    setQueue(remaining);
    saveQueue(remaining);
  }, [online, run]);

  useEffect(() => {
    if (!online) return;
    void sync();
  }, [online, sync]);

  const pendingCount = useMemo(() => queue.length, [queue]);

  return { online, enqueue, sync, pendingCount };
}

