import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { createScribeRealtimeToken } from '@/lib/elevenlabs/server';

export const runtime = 'nodejs';

export async function GET() {
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

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return NextResponse.json(
      { error: 'Speech service is not configured' },
      { status: 503 }
    );
  }

  try {
    const token = await createScribeRealtimeToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to create speech token' },
        { status: 503 }
      );
    }
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Speech token error';
    console.error('[scribe-token]', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
