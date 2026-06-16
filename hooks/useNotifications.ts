'use client';

import { useEffect, useState, useCallback } from 'react';
import { SSEEvent } from '@/lib/sse/emitter';

export function useNotifications(onNotification?: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  const connect = useCallback(() => {
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (data.type !== 'HEARTBEAT') {
          setLastEvent(data);
          onNotification?.(data);
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      setTimeout(connect, 5000);
    };

    return eventSource;
  }, [onNotification]);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);

  return { connected, lastEvent };
}
