import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import selfsigned from 'selfsigned';

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = join(__dirname, '..', 'certificates');

export function getNetworkIpCandidates() {
  const candidates = [];
  const nets = networkInterfaces();

  for (const [name, interfaces] of Object.entries(nets)) {
    if (/vEthernet|WSL|Docker|VMware|VirtualBox|Hyper-V|Loopback|Npcap/i.test(name)) {
      continue;
    }
    for (const net of interfaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push({ name, address: net.address });
      }
    }
  }

  return candidates;
}

export function getPreferredNetworkIp(candidates = getNetworkIpCandidates()) {
  const wifiNamed = candidates.filter((c) => /wi-?fi|wlan|wireless/i.test(c.name));
  if (wifiNamed.length > 0) {
    const notHotspot = wifiNamed.find((c) => !c.address.startsWith('192.168.137.'));
    return (notHotspot ?? wifiNamed[0]).address;
  }

  const rank = (addr) => {
    if (addr.startsWith('192.168.') && !addr.startsWith('192.168.137.')) return 0;
    if (addr.startsWith('10.')) return 1;
    if (addr.startsWith('192.168.')) return 2;
    if (addr.startsWith('172.')) return 4;
    return 3;
  };

  const sorted = [...candidates].sort((a, b) => rank(a.address) - rank(b.address));
  return sorted[0]?.address ?? '127.0.0.1';
}

export async function ensureDevCert(lanIp) {
  mkdirSync(certDir, { recursive: true });

  const keyPath = join(certDir, 'dev-key.pem');
  const certPath = join(certDir, 'dev-cert.pem');
  const metaPath = join(certDir, 'meta.json');

  let needsRegen = !existsSync(keyPath) || !existsSync(certPath);
  if (!needsRegen && existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      if (meta.ip !== lanIp) needsRegen = true;
    } catch {
      needsRegen = true;
    }
  }

  if (!needsRegen) {
    return { keyPath, certPath, regenerated: false };
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' },
  ];

  if (lanIp && lanIp !== '127.0.0.1') {
    altNames.push({ type: 7, ip: lanIp });
  }

  const pems = await selfsigned.generate([{ name: 'commonName', value: 'MTMS Dev' }], {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  writeFileSync(keyPath, pems.private);
  writeFileSync(certPath, pems.cert);
  writeFileSync(
    metaPath,
    JSON.stringify({ ip: lanIp, createdAt: new Date().toISOString() }, null, 2)
  );

  return { keyPath, certPath, regenerated: true };
}
