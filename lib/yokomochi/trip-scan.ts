/** Normalize USB scanner / QR paste input to a trip or order code. */
export function normalizeTripScanInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  for (const line of trimmed.split(/[\r\n]+/)) {
    const match = line.trim().match(/YM-\d{8}-[A-Z0-9]+(?:-S\d+-T\d+)?/i);
    if (match) return match[0].toUpperCase();
  }

  const compact = trimmed.replace(/\s/g, '');
  const match = compact.match(/YM-\d{8}-[A-Z0-9]+(?:-S\d+-T\d+)?/i);
  return (match?.[0] ?? trimmed).toUpperCase();
}

export function extractYokomochiArrivalToken(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/confirm\/yokomochi\/([a-f0-9]+)/i);
  return match?.[1] ?? null;
}

export type YokomochiScanPayload =
  | { kind: 'token'; token: string }
  | { kind: 'tripCode'; tripCode: string };

export function parseYokomochiScanPayload(raw: string): YokomochiScanPayload | null {
  const token = extractYokomochiArrivalToken(raw);
  if (token) return { kind: 'token', token };

  const tripCode = normalizeTripScanInput(raw);
  if (tripCode && /^YM-/i.test(tripCode)) {
    return { kind: 'tripCode', tripCode };
  }

  return null;
}

export function isTripLegCode(code: string): boolean {
  return /-S\d+-T\d+$/i.test(code);
}
