'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendNegotiationChatMessage } from '@/app/actions/negotiation-chat';
import { ChatMessageContent } from '@/components/yokomochi/ChatMessageContent';
import { useJapaneseSpeechToText } from '@/hooks/useJapaneseSpeechToText';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Mic, Send, Square } from 'lucide-react';

type ChatMessage = {
  id: string;
  message: string;
  createdAt: Date | string;
  sender: { id: string; name: string; role: string };
};

export function NegotiationChatPanel({
  orderId,
  orderNo,
  initialMessages,
  viewerRole,
  readOnly = false,
  onMessagesChange,
}: {
  orderId: string;
  orderNo: string;
  initialMessages: ChatMessage[];
  viewerRole: 'MARUICHI_STAFF' | 'FACTORY_STAFF';
  readOnly?: boolean;
  onMessagesChange?: (messages: ChatMessage[]) => void;
}) {
  const { t, formatDate } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef<string | undefined>(
    initialMessages.length > 0
      ? new Date(initialMessages[initialMessages.length - 1].createdAt).toISOString()
      : undefined
  );

  const {
    listening,
    displayText,
    error: speechError,
    startListening,
    stopRecognition,
    reset: resetSpeech,
  } = useJapaneseSpeechToText();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, listening, displayText]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    if (readOnly) return;
    const es = new EventSource(`/api/negotiation/${orderId}/stream?since=${lastTsRef.current ?? ''}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'MESSAGES' && Array.isArray(data.messages)) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of data.messages as ChatMessage[]) {
              if (!ids.has(m.id)) merged.push(m);
            }
            return merged.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          const last = data.messages[data.messages.length - 1];
          if (last?.createdAt) lastTsRef.current = new Date(last.createdAt).toISOString();
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [orderId, readOnly]);

  function sendMessage(message: string) {
    const msg = message.trim();
    if (!msg || isPending) return;
    startTransition(async () => {
      const result = await sendNegotiationChatMessage({ yokomochiOrderId: orderId, message: msg });
      if (result.success) {
        setText('');
        resetSpeech();
      }
    });
  }

  function send() {
    sendMessage(listening ? displayText : text);
  }

  function toggleSpeech() {
    if (listening) {
      void (async () => {
        const spoken = await stopRecognition();
        if (spoken) {
          sendMessage(spoken);
        } else {
          resetSpeech();
        }
      })();
      return;
    }
    void (async () => {
      setText('');
      const started = await startListening();
      if (!started) {
        resetSpeech();
      }
    })();
  }

  const inputValue = listening ? displayText : text;
  const speechErrorMessage =
    speechError === 'insecure'
      ? t('chat.speechInsecure')
      : speechError === 'mic-denied'
        ? t('chat.speechMicDenied')
        : speechError === 'network'
          ? t('chat.speechNetwork')
          : speechError === 'unconfigured'
            ? t('chat.speechUnconfigured')
            : speechError === 'service-error'
              ? t('chat.speechServiceError')
              : speechError === 'failed'
                ? t('chat.speechFailed')
                : null;

  return (
    <div className="flex h-[360px] flex-col rounded-xl border bg-white">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-semibold">{t('factory.negotiationChat')}</p>
        <p className="text-xs text-muted-foreground">
          {readOnly
            ? t('history.negotiationArchive')
            : interpolate(t('factory.chatSubtitle'), { orderNo })}
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">{t('factory.chatEmpty')}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender.role === viewerRole;
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  mine
                    ? 'max-w-[88%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'max-w-[88%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm'
                }
              >
                <p className="text-[10px] opacity-80">{m.sender.name}</p>
                <ChatMessageContent message={m.message} mine={mine} />
                <p className="mt-1 text-[10px] opacity-70">{formatDate(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {!readOnly && (
        <div className="space-y-2 border-t p-2">
          {listening && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <p className="text-xs text-rose-800">{t('chat.speechListening')}</p>
            </div>
          )}
          {speechErrorMessage && (
            <p className="text-xs text-destructive">{speechErrorMessage}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => {
                if (!listening) setText(e.target.value);
              }}
              readOnly={listening}
              placeholder={
                listening ? t('chat.speechPlaceholder') : t('factory.chatPlaceholder')
              }
              className={cn(listening && 'border-rose-200 bg-rose-50/50')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !listening) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant={listening ? 'destructive' : 'outline'}
              disabled={isPending}
              onClick={toggleSpeech}
              aria-label={listening ? t('chat.speechStopSend') : t('chat.speechStart')}
              title={listening ? t('chat.speechStopSend') : t('chat.speechStart')}
            >
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              disabled={isPending || listening || !inputValue.trim()}
              onClick={send}
              aria-label={t('common.send')}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('chat.speechHint')}</p>
        </div>
      )}
    </div>
  );
}
