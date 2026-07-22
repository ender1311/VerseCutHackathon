import { getBrazeEnv, uploadToBraze } from '@/lib/server/braze';
import { validateUploadFile } from '@/lib/server/uploadGuards';

export const maxDuration = 60;

export async function POST(request: Request) {
  const env = getBrazeEnv();
  if (!env) {
    return Response.json({ error: 'Braze is not configured (missing BRAZE_API_KEY)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const name = form.get('name');
  const v = validateUploadFile(file);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  const f = file as File;

  const bytes = new Uint8Array(await f.arrayBuffer());
  try {
    const { url } = await uploadToBraze(bytes, {
      name: typeof name === 'string' && name ? name : f.name || 'asset.jpg',
      mime: f.type || 'image/jpeg',
      env,
    });
    return Response.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[braze/upload] failed:', detail);
    return Response.json({ error: 'Braze upload failed', detail }, { status: 502 });
  }
}
