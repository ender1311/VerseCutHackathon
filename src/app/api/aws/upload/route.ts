import { getAwsEnv, uploadToS3 } from '@/lib/server/aws';
import { validateUploadFile, isValidExportKey } from '@/lib/server/uploadGuards';

export const maxDuration = 60;

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
  const v = validateUploadFile(file);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  if (!isValidExportKey(key)) {
    return Response.json({ error: 'invalid key (must match versecut/<date>/<ref>/<id>)' }, { status: 400 });
  }

  const f = file as File;
  const bytes = new Uint8Array(await f.arrayBuffer());
  try {
    const { url } = await uploadToS3(bytes, { key, mime: f.type || 'image/jpeg', env });
    return Response.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[aws/upload] failed:', detail);
    return Response.json({ error: 'AWS upload failed', detail }, { status: 502 });
  }
}
