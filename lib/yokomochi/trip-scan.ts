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

export function isTripLegCode(code: string): boolean {
  return /-S\d+-T\d+$/i.test(code);
}
