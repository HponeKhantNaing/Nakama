'use client';

import { CommitStrategy, RealtimeEvents, Scribe, type RealtimeConnection } from '@elevenlabs/client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechToTextError =
  | 'insecure'
  | 'mic-denied'
  | 'network'
  | 'unconfigured'
  | 'service-error'
  | 'failed';

const SCRIBE_MODEL_ID = 'scribe_v2_realtime';
const STOP_FLUSH_MS = 900;

function mergeTranscript(committed: string, partial: string) {
  return `${committed}${partial}`.trim();
}

export function useJapaneseSpeechToText() {
  const [listening, setListening] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [error, setError] = useState<SpeechToTextError | null>(null);

  const connectionRef = useRef<RealtimeConnection | null>(null);
  const committedRef = useRef('');
  const partialRef = useRef('');
  const displayRef = useRef('');
  const wantsListeningRef = useRef(false);

  useEffect(() => {
    displayRef.current = displayText;
  }, [displayText]);

  const updateDisplay = useCallback((committed: string, partial: string) => {
    committedRef.current = committed;
    partialRef.current = partial;
    const combined = mergeTranscript(committed, partial);
    displayRef.current = combined;
    setDisplayText(combined);
    if (combined) {
      setError(null);
    }
  }, []);

  const detachConnection = useCallback((connection: RealtimeConnection | null) => {
    if (!connection) return;
    try {
      connection.close();
    } catch {
      /* ignore */
    }
    if (connectionRef.current === connection) {
      connectionRef.current = null;
    }
  }, []);

  const handleScribeError = useCallback(() => {
    if (!wantsListeningRef.current) return;
    wantsListeningRef.current = false;
    setListening(false);
    setError('service-error');
    detachConnection(connectionRef.current);
  }, [detachConnection]);

  const attachConnectionHandlers = useCallback(
    (connection: RealtimeConnection) => {
      connection.on(RealtimeEvents.SESSION_STARTED, () => {
        setListening(true);
        setError(null);
      });

      connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        updateDisplay(committedRef.current, data.text ?? '');
      });

      connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        const piece = data.text ?? '';
        if (!piece) return;
        const committed = `${committedRef.current}${piece}`;
        updateDisplay(committed, '');
      });

      connection.on(RealtimeEvents.AUTH_ERROR, handleScribeError);
      connection.on(RealtimeEvents.QUOTA_EXCEEDED, handleScribeError);
      connection.on(RealtimeEvents.RATE_LIMITED, handleScribeError);
      connection.on(RealtimeEvents.TRANSCRIBER_ERROR, handleScribeError);
      connection.on(RealtimeEvents.ERROR, handleScribeError);

      connection.on(RealtimeEvents.CLOSE, () => {
        if (connectionRef.current === connection) {
          connectionRef.current = null;
        }
        if (!wantsListeningRef.current) {
          setListening(false);
        }
      });
    },
    [handleScribeError, updateDisplay]
  );

  const reset = useCallback(() => {
    committedRef.current = '';
    partialRef.current = '';
    displayRef.current = '';
    setDisplayText('');
    setError(null);
  }, []);

  const stopRecognition = useCallback(async (): Promise<string> => {
    wantsListeningRef.current = false;
    setListening(false);

    const connection = connectionRef.current;
    if (connection) {
      try {
        connection.commit();
      } catch {
        /* ignore */
      }

      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, STOP_FLUSH_MS);
        const onCommitted = (data: { text?: string }) => {
          const piece = data.text ?? '';
          if (piece) {
            committedRef.current = `${committedRef.current}${piece}`;
            partialRef.current = '';
            const combined = committedRef.current.trim();
            displayRef.current = combined;
            setDisplayText(combined);
          }
        };
        connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, onCommitted);
        window.setTimeout(() => {
          connection.off(RealtimeEvents.COMMITTED_TRANSCRIPT, onCommitted);
          window.clearTimeout(timeout);
          resolve();
        }, STOP_FLUSH_MS);
      });

      detachConnection(connection);
    }

    const result = (committedRef.current || displayRef.current).trim();
    partialRef.current = '';
    displayRef.current = result;
    setDisplayText(result);
    return result;
  }, [detachConnection]);

  const startListening = useCallback(async (): Promise<boolean> => {
    if (wantsListeningRef.current || connectionRef.current) {
      return true;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('insecure');
      return false;
    }

    setError(null);
    reset();
    wantsListeningRef.current = true;

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch('/api/speech/scribe-token');
    } catch {
      wantsListeningRef.current = false;
      setError('network');
      return false;
    }

    if (tokenResponse.status === 503) {
      wantsListeningRef.current = false;
      setError('unconfigured');
      return false;
    }

    if (!tokenResponse.ok) {
      wantsListeningRef.current = false;
      setError(tokenResponse.status === 401 ? 'failed' : 'service-error');
      return false;
    }

    let token: string;
    try {
      const payload = (await tokenResponse.json()) as { token?: string };
      token = payload.token ?? '';
    } catch {
      wantsListeningRef.current = false;
      setError('service-error');
      return false;
    }

    if (!token) {
      wantsListeningRef.current = false;
      setError('service-error');
      return false;
    }

    try {
      const connection = Scribe.connect({
        token,
        modelId: SCRIBE_MODEL_ID,
        languageCode: 'ja',
        commitStrategy: CommitStrategy.VAD,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      connectionRef.current = connection;
      attachConnectionHandlers(connection);
      setListening(true);
      return true;
    } catch (err) {
      wantsListeningRef.current = false;
      setListening(false);
      connectionRef.current = null;

      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('mic-denied');
      } else {
        setError('failed');
      }
      return false;
    }
  }, [attachConnectionHandlers, reset]);

  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      detachConnection(connectionRef.current);
    };
  }, [detachConnection]);

  return {
    listening,
    displayText,
    error,
    startListening,
    stopRecognition,
    reset,
  };
};
