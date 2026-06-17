import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

export function generateRequestNo(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TR-${datePart}-${randomPart}`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    SHINWA_ACCEPTED: 'Accepted',
    SUBCONTRACTED: 'Subcontracted',
    DRIVER_ASSIGNED: 'Driver Assigned',
    DISPATCHED: 'Dispatched',
    PICKED_UP: 'Picked Up',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };
  return labels[status] ?? status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SHINWA_ACCEPTED: 'bg-blue-100 text-blue-800',
    SUBCONTRACTED: 'bg-purple-100 text-purple-800',
    DRIVER_ASSIGNED: 'bg-indigo-100 text-indigo-800',
    DISPATCHED: 'bg-cyan-100 text-cyan-800',
    PICKED_UP: 'bg-primary/10 text-primary',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800';
}
