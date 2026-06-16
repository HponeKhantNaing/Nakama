import { SSEEvent } from './emitter';

type SSEClient = {
  id: string;
  companyId?: string;
  userId?: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  emit(companyId: string, event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of Array.from(this.clients.values())) {
      if (client.companyId === companyId) {
        try {
          client.controller.enqueue(client.encoder.encode(data));
        } catch {
          this.removeClient(client.id);
        }
      }
    }
  }

  emitToUser(userId: string, event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of Array.from(this.clients.values())) {
      if (client.userId === userId) {
        try {
          client.controller.enqueue(client.encoder.encode(data));
        } catch {
          this.removeClient(client.id);
        }
      }
    }
  }

  emitHeartbeat(): void {
    const event: SSEEvent = {
      type: 'HEARTBEAT',
      title: 'heartbeat',
      message: 'ping',
      timestamp: new Date().toISOString(),
    };
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of Array.from(this.clients.values())) {
      try {
        client.controller.enqueue(client.encoder.encode(data));
      } catch {
        this.removeClient(client.id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();

// Heartbeat every 30 seconds to keep connections alive
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    sseManager.emitHeartbeat();
  }, 30000);
}
