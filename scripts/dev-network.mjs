import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ensureDevCert,
  getNetworkIpCandidates,
  getPreferredNetworkIp,
} from './ensure-dev-cert.mjs';

const require = createRequire(import.meta.url);

const port = process.env.PORT ?? '3000';
const forceHttp = process.env.DEV_HTTP === '1';
const ipCandidates = getNetworkIpCandidates();
const ip = getPreferredNetworkIp(ipCandidates);

let protocol = 'http';
let localUrl = `http://localhost:${port}`;
let networkUrl = `http://${ip}:${port}`;
let certPaths = null;

if (!forceHttp) {
  try {
    certPaths = await ensureDevCert(ip);
    protocol = 'https';
    localUrl = `https://localhost:${port}`;
    networkUrl = `https://${ip}:${port}`;
  } catch (error) {
    console.error('\n  ⚠ HTTPS certificate generation failed — using HTTP.\n');
    console.error(`  ${error instanceof Error ? error.message : error}\n`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  MTMS — Network Development Server');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Local:   ${localUrl}`);
console.log(`  Phone:   ${networkUrl}`);
if (ipCandidates.length > 1) {
  console.log('  Other IPs on this PC (try if Phone URL fails):');
  for (const c of ipCandidates) {
    if (c.address === ip) continue;
    console.log(`           ${protocol}://${c.address}:${port}  (${c.name})`);
  }
}
console.log('  Connect phone/tablet to the same Wi-Fi network.');

if (protocol === 'https') {
  console.log('');
  console.log('  HTTPS is ON (QR camera on phone).');
  if (certPaths?.regenerated) {
    console.log('  Dev certificate was generated in ./certificates/');
  }
  console.log('  On phone: open the Phone URL above.');
  console.log('  Certificate warning → Advanced → Proceed / Continue.');
} else {
  console.log('');
  console.log('  HTTP mode — use http:// URLs (not https://).');
  if (!forceHttp) {
    console.log('  QR camera on phone will not work until HTTPS is enabled.');
  }
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const nextCli = require.resolve('next/dist/bin/next');
const nextArgs = ['dev', '-H', '0.0.0.0', '-p', port];

if (protocol === 'https' && certPaths) {
  nextArgs.push(
    '--experimental-https',
    '--experimental-https-key',
    certPaths.keyPath,
    '--experimental-https-cert',
    certPaths.certPath
  );
}

const child = spawn(process.execPath, [nextCli, ...nextArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXTAUTH_URL: networkUrl,
    APP_PUBLIC_URL: networkUrl,
  },
});

child.on('error', (error) => {
  console.error('Failed to start Next.js dev server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
