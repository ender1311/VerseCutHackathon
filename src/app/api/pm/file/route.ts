import { NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pmEnabled, resolveOutputPath } from '@/lib/server/pm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!pmEnabled()) {
    return NextResponse.json({ error: 'Product Marketing builds run only in local dev' }, { status: 403 });
  }
  const url = new URL(req.url);
  const feature = url.searchParams.get('feature') ?? '';
  const name = url.searchParams.get('name') ?? '';
  const path = resolveOutputPath(feature, name);
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const size = statSync(path).size;
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Cache-Control': 'no-store',
    },
  });
}
