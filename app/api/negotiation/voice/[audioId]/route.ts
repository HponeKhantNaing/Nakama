import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { parseNegotiationChatPayload, isVoicePayload } from '@/lib/yokomochi/negotiation-chat-payload';
import { readNegotiationVoiceAudio } from '@/lib/yokomochi/negotiation-voice-storage';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { audioId: string } }
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

  const voiceRow = await prisma.negotiationChatMessage.findFirst({
    where: { message: { contains: params.audioId } },
    include: { yokomochiOrder: { include: { factoryRequest: true } } },
  });

  if (!voiceRow?.yokomochiOrder.factoryRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const payload = parseNegotiationChatPayload(voiceRow.message);
  if (!isVoicePayload(payload) || payload.audioId !== params.audioId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const fr = voiceRow.yokomochiOrder.factoryRequest;
  const allowed =
    session.user.role === UserRole.MARUICHI_STAFF
      ? fr.warehouseCompanyId === session.user.companyId
      : fr.factoryCompanyId === session.user.companyId;

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const file = await readNegotiationVoiceAudio(params.audioId);
  if (!file) {
    return NextResponse.json({ error: 'Audio file missing' }, { status: 404 });
  }

  return new NextResponse(Uint8Array.from(file.bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
