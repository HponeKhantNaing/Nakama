'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { sendNegotiationChatMessage } from '@/app/actions/negotiation-chat';
import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import { Send } from 'lucide-react';

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
  onMessagesChange,
}: {
  orderId: string;
  orderNo: string;
  initialMessages: ChatMessage[];
  viewerRole: 'MARUICHI_STAFF' | 'FACTORY_STAFF';
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
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
  }, [orderId]);

  function send() {
    const msg = text.trim();
    if (!msg) return;
    startTransition(async () => {
      const result = await sendNegotiationChatMessage({ yokomochiOrderId: orderId, message: msg });
      if (result.success) setText('');
    });
  }

  return (
    <div className="flex h-[320px] flex-col rounded-xl border bg-white">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-semibold">{t('factory.negotiationChat')}</p>
        <p className="text-xs text-muted-foreground">
          {interpolate(t('factory.chatSubtitle'), { orderNo })}
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
                    ? 'max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'max-w-[85%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm'
                }
              >
                <p className="text-[10px] opacity-80">{m.sender.name}</p>
                <p>{m.message}</p>
                <p className="mt-1 text-[10px] opacity-70">{formatDate(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('factory.chatPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" disabled={isPending} onClick={send} aria-label={t('common.send')}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
