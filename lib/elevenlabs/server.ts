import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let client: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  if (!client) {
    client = new ElevenLabsClient({ apiKey });
  }
  return client;
}

export async function createScribeRealtimeToken(): Promise<string | null> {
  const elevenlabs = getElevenLabsClient();
  if (!elevenlabs) return null;

  const response = await elevenlabs.tokens.singleUse.create('realtime_scribe');
  return response.token;
}
