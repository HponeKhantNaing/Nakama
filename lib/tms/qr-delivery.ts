import { randomBytes } from 'crypto';

export function generateDeliveryToken(): string {
  return randomBytes(32).toString('hex');
}

export function getQrPayload(token: string, pathPrefix = '/delivery/confirm'): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base}${pathPrefix}/${token}`;
}

export function getTokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
