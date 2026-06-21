import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateYokomochiArrivalQr } from '@/app/actions/yokomochi';
import { resolveRequestBaseUrl } from '@/lib/app-url';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const baseUrl = resolveRequestBaseUrl(req);
  const result = await generateYokomochiArrivalQr(params.taskId, baseUrl);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL((result.data as { url: string }).url, {
    width: 300,
    margin: 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });

  const payload = result.data as { token: string; url: string };
  return NextResponse.json({ ...payload, qrDataUrl });
}
