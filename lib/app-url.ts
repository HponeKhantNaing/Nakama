/** Resolve the public app base URL for links embedded in QR codes and emails. */
export function resolveAppBaseUrl(origin?: string | null): string {
  const envUrl = (process.env.APP_PUBLIC_URL ?? process.env.NEXTAUTH_URL)?.replace(/\/$/, '');

  if (origin) {
    try {
      const parsed = new URL(origin);
      const host = parsed.host;

      if (envUrl) {
        const envHost = new URL(envUrl).hostname;
        if (envHost === 'localhost' || envHost === '127.0.0.1') {
          return `${parsed.protocol}//${host}`;
        }
      } else if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        return `${parsed.protocol}//${host}`;
      }
    } catch {
      // fall through to env default
    }
  }

  return envUrl ?? 'http://localhost:3000';
}

export function resolveRequestBaseUrl(req: { headers: Headers }): string {
  const origin = req.headers.get('origin');
  if (origin) return resolveAppBaseUrl(origin);

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const ref = new URL(referer);
      return resolveAppBaseUrl(`${ref.protocol}//${ref.host}`);
    } catch {
      // fall through
    }
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto =
      req.headers.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return resolveAppBaseUrl(`${proto}://${host}`);
  }

  return resolveAppBaseUrl(null);
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
}
