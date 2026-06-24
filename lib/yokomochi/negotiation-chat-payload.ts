export type NegotiationVoicePayload = {
  type: 'voice';
  audioId: string;
  durationSec: number;
  mimeType: string;
  transcript?: string;
};

export type NegotiationI18nPayload = {
  i18nKey: string;
  params?: Record<string, string | number>;
};

export function isVoicePayload(value: unknown): value is NegotiationVoicePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as NegotiationVoicePayload).type === 'voice' &&
    typeof (value as NegotiationVoicePayload).audioId === 'string'
  );
}

export function parseNegotiationChatPayload(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

export function buildVoiceMessagePayload(payload: NegotiationVoicePayload): string {
  return JSON.stringify(payload);
}
