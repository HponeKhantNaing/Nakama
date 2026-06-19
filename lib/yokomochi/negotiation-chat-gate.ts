type ChatMessageLike = {
  createdAt: Date | string;
  sender: { role: string };
};

type HistoryLike = {
  action: string;
  createdAt: Date | string;
};

/** Latest warehouse renegotiation (REQUEST_AGAIN) timestamp, if any. */
export function lastRenegotiationAt(history: HistoryLike[] | undefined): Date | null {
  const entry = history?.find((h) => h.action === 'REQUEST_AGAIN');
  return entry ? new Date(entry.createdAt) : null;
}

/** Factory may submit when they have chatted — after renegotiation, only messages after REQUEST_AGAIN count. */
export function factoryChatAllowsSubmit(
  messages: ChatMessageLike[],
  lastRenegotiation: Date | null
): boolean {
  const factoryMessages = messages.filter((m) => m.sender.role === 'FACTORY_STAFF');
  if (factoryMessages.length === 0) return false;
  if (!lastRenegotiation) return true;
  const cutoff = lastRenegotiation.getTime();
  return factoryMessages.some((m) => new Date(m.createdAt).getTime() > cutoff);
}
