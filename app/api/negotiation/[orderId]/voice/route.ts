import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveSessionUserId } from '@/lib/session';
import { buildVoiceMessagePayload } from '@/lib/yokomochi/negotiation-chat-payload';
import {
  MAX_VOICE_DURATION_SEC,
  saveNegotiationVoiceAudio,
} from '@/lib/yokomochi/negotiation-voice-storage';
import { assertNegotiationChatAccess } from '@/lib/yokomochi/negotiation-order-access';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (
    session.user.role !== UserRole.MARUICHI_STAFF &&
    session.user.role !== UserRole.FACTORY_STAFF
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const access = await assertNegotiationChatAccess(params.orderId, session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const formData = await req.formData();
  const audio = formData.get('audio');
  const durationRaw = formData.get('durationSec');
  const transcriptRaw = formData.get('transcript');

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
  }

  const durationSec = Number(durationRaw);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_VOICE_DURATION_SEC) {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
  }

  const mimeType = audio.type || 'audio/webm';
  const bytes = Buffer.from(await audio.arrayBuffer());

  let audioId: string;
  let storedMime: string;
  try {
    const saved = await saveNegotiationVoiceAudio(bytes, mimeType);
    audioId = saved.audioId;
    storedMime = saved.storedMime;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save audio';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const transcript =
    typeof transcriptRaw === 'string' && transcriptRaw.trim()
      ? transcriptRaw.trim().slice(0, 2000)
      : undefined;

  const userId = await resolveSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const message = await prisma.negotiationChatMessage.create({
    data: {
      yokomochiOrderId: params.orderId,
      senderUserId: userId,
      senderRole: session.user.role as UserRole,
      senderCompanyId: session.user.companyId,
      message: buildVoiceMessagePayload({
        type: 'voice',
        audioId,
        durationSec: Math.round(durationSec * 10) / 10,
        mimeType: storedMime,
        transcript,
      }),
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ success: true, message });
}
