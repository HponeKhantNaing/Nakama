import { randomBytes } from 'crypto';

export function generateArrivalToken(): string {
  return randomBytes(32).toString('hex');
}

export function getYokomochiQrPayload(token: string, baseUrl?: string): string {
  const base = (
    baseUrl ??
    process.env.APP_PUBLIC_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
  return `${base}/confirm/yokomochi/${token}`;
}

export function getArrivalTokenExpiry(hours = 48): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
