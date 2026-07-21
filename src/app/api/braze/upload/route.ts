import { getBrazeEnv, uploadToBraze } from '@/lib/server/braze';

export async function POST(request: Request) {
  const env = getBrazeEnv();
  if (!env) {
    return Response.json({ error: 'Braze is not configured (missing BRAZE_API_KEY)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const name = form.get('name');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const { url } = await uploadToBraze(bytes, {
      name: typeof name === 'string' && name ? name : file.name || 'asset.jpg',
      mime: file.type || 'image/jpeg',
      env,
    });
    return Response.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[braze/upload] failed:', detail);
    return Response.json({ error: 'Braze upload failed', detail }, { status: 502 });
  }
}
