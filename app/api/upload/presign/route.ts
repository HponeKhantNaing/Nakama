import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPresignedUploadUrl, buildS3Key } from '@/lib/s3';
import { z } from 'zod';

const uploadSchema = z.object({
  requestId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  type: z.enum(['proof', 'delivery']),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
  }

  const { requestId, filename, contentType, type } = parsed.data;
  const key = buildS3Key(type, requestId, filename);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION ?? 'ap-northeast-1'}.amazonaws.com/${key}`,
  });
}
