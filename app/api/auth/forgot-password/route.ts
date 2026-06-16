import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { PASSWORD_RESET_EXPIRY_MS } from '@/lib/auth-constants';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'email_not_found' }, { status: 404 });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const requestUrl = new URL(request.url);
    const resetUrl = `${requestUrl.origin}/reset-password?token=${token}`;

    return NextResponse.json({
      success: true,
      resetUrl,
    });
  } catch {
    return NextResponse.json({ error: 'request_failed' }, { status: 500 });
  }
}
