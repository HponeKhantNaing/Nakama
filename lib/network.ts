import { networkInterfaces } from 'node:os';

export function getLocalNetworkIp(): string {
  const nets = networkInterfaces();

  for (const interfaces of Object.values(nets)) {
    for (const net of interfaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return '127.0.0.1';
}

export function getNetworkDevUrl(port = process.env.PORT ?? '3000'): string {
  return `http://${getLocalNetworkIp()}:${port}`;
}
