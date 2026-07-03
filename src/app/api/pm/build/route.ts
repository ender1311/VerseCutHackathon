import { NextResponse } from 'next/server';
import { pmEnabled, startBuild } from '@/lib/server/pm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!pmEnabled()) {
    return NextResponse.json({ error: 'Product Marketing builds run only in local dev' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  try {
    const { jobId } = startBuild({
      feature: String(b.feature ?? ''),
      langs: Array.isArray(b.langs) ? b.langs.map(String) : [],
      formats: Array.isArray(b.formats) ? b.formats.map(String) : [],
      lengths: Array.isArray(b.lengths) ? b.lengths.map(String) : [],
      capture: !!b.capture,
      subtitles: b.subtitles !== false,
      voiceover: b.voiceover !== false,
    });
    return NextResponse.json({ data: { jobId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Build failed to start';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
