import { getAirEnv, uploadToAir } from '@/lib/server/air';
import { validateUploadFile } from '@/lib/server/uploadGuards';

export const maxDuration = 60;

export async function POST(request: Request) {
  const env = getAirEnv();
  if (!env) {
    return Response.json({ error: 'AIR is not configured (missing AIR_API_KEY/AIR_WORKSPACE_ID)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const v = validateUploadFile(file);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  const f = file as File;

  const bytes = new Uint8Array(await f.arrayBuffer());
  try {
    const { cdnUrl } = await uploadToAir(bytes, {
      fileName: f.name || 'asset.png',
      mime: f.type || 'image/png',
      env,
    });
    return Response.json({ data: { cdnUrl } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[air/upload] failed:', detail);
    return Response.json({ error: 'AIR upload failed', detail }, { status: 502 });
  }
}
