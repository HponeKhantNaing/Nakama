import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const VOICE_DIR = path.join(process.cwd(), 'data', 'negotiation-voice');

const ALLOWED_MIME: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/webm;codecs=opus': '.webm',
  'audio/ogg': '.ogg',
  'audio/ogg;codecs=opus': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
};

export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_DURATION_SEC = 120;

export function normalizeVoiceMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return base;
}

export function extensionForMime(mimeType: string): string | null {
  const normalized = normalizeVoiceMimeType(mimeType);
  return ALLOWED_MIME[mimeType] ?? ALLOWED_MIME[normalized] ?? null;
}

export async function saveNegotiationVoiceAudio(
  bytes: Buffer,
  mimeType: string
): Promise<{ audioId: string; storedMime: string }> {
  const ext = extensionForMime(mimeType);
  if (!ext) {
    throw new Error('Unsupported audio format');
  }
  if (bytes.byteLength > MAX_VOICE_BYTES) {
    throw new Error('Voice message too large');
  }

  await mkdir(VOICE_DIR, { recursive: true });
  const audioId = randomUUID();
  const filePath = path.join(VOICE_DIR, `${audioId}${ext}`);
  await writeFile(filePath, bytes);

  return { audioId, storedMime: normalizeVoiceMimeType(mimeType) || mimeType };
}

export async function readNegotiationVoiceAudio(audioId: string): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  if (!/^[a-f0-9-]{36}$/i.test(audioId)) return null;

  for (const ext of Object.values(new Set(Object.values(ALLOWED_MIME)))) {
    const filePath = path.join(VOICE_DIR, `${audioId}${ext}`);
    try {
      const bytes = await readFile(filePath);
      const mimeType =
        ext === '.webm'
          ? 'audio/webm'
          : ext === '.ogg'
            ? 'audio/ogg'
            : ext === '.m4a'
              ? 'audio/mp4'
              : ext === '.mp3'
                ? 'audio/mpeg'
                : 'audio/wav';
      return { bytes, mimeType };
    } catch {
      /* try next extension */
    }
  }
  return null;
}
