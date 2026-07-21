import { getAwsEnv, uploadToS3 } from '@/lib/server/aws';

export async function POST(request: Request) {
  const env = getAwsEnv();
  if (!env) {
    return Response.json(
      { error: 'AWS is not configured (missing AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_S3_BUCKET)' },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  const key = form.get('key');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 });
  }
  if (typeof key !== 'string' || !key) {
    return Response.json({ error: 'key field is required' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const { url } = await uploadToS3(bytes, { key, mime: file.type || 'image/jpeg', env });
    return Response.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[aws/upload] failed:', detail);
    return Response.json({ error: 'AWS upload failed', detail }, { status: 502 });
  }
}
