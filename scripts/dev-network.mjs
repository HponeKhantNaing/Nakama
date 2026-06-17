import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

function getLocalNetworkIp() {
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

const port = process.env.PORT ?? '3000';
const ip = getLocalNetworkIp();
const networkUrl = `http://${ip}:${port}`;

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  MTMS — Network Development Server');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Local:   http://localhost:${port}`);
console.log(`  Phone:   ${networkUrl}`);
console.log(`  Tablet:  ${networkUrl}`);
console.log('  Connect phone/tablet to the same Wi-Fi network.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const child = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXTAUTH_URL: networkUrl,
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
