import { NotificationType } from '@prisma/client';
import { sseManager } from './index';

export interface SSEEvent {
  type: NotificationType | 'HEARTBEAT';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export async function emitNotificationEvent(
  companyId: string,
  event: Omit<SSEEvent, 'timestamp'>
): Promise<void> {
  const payload: SSEEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  sseManager.emit(companyId, payload);
}

export async function emitUserNotificationEvent(
  userId: string,
  event: Omit<SSEEvent, 'timestamp'>
): Promise<void> {
  const payload: SSEEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  sseManager.emitToUser(userId, payload);
}
