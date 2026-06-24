'use client';

import { interpolate } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';
import {
  isVoicePayload,
  parseNegotiationChatPayload,
  type NegotiationVoicePayload,
} from '@/lib/yokomochi/negotiation-chat-payload';
import { Mic } from 'lucide-react';

function formatVoiceDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export function ChatMessageContent({
  message,
  mine,
}: {
  message: string;
  mine?: boolean;
}) {
  const { t } = useTranslation();
  const parsed = parseNegotiationChatPayload(message);

  if (parsed && typeof parsed === 'object' && 'i18nKey' in parsed) {
    const i18n = parsed as { i18nKey: string; params?: Record<string, string | number> };
    return <p>{interpolate(t(i18n.i18nKey as TranslationKey), i18n.params ?? {})}</p>;
  }

  if (isVoicePayload(parsed)) {
    return <VoiceMessageBubble payload={parsed} mine={mine} />;
  }

  return <p className="whitespace-pre-wrap break-words">{message}</p>;
}

function VoiceMessageBubble({
  payload,
}: {
  payload: NegotiationVoicePayload;
  mine?: boolean;
}) {
  const { t } = useTranslation();
  const src = `/api/negotiation/voice/${payload.audioId}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-90">
        <Mic className="h-3 w-3" />
        <span>{t('chat.voiceMessage')}</span>
        <span>· {formatVoiceDuration(payload.durationSec)}</span>
      </div>
      <audio
        controls
        src={src}
        className="h-9 w-full min-w-[200px]"
        preload="metadata"
      />
      {payload.transcript ? (
        <p className="rounded-md bg-black/10 px-2 py-1 text-xs leading-relaxed">
          <span className="font-medium opacity-80">{t('chat.voiceTranscript')}: </span>
          {payload.transcript}
        </p>
      ) : null}
    </div>
  );
}
