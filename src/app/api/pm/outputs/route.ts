import { NextResponse } from 'next/server';
import { listOutputs, pmEnabled } from '@/lib/server/pm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!pmEnabled()) {
    return NextResponse.json({ error: 'Product Marketing builds run only in local dev' }, { status: 403 });
  }
  const feature = new URL(req.url).searchParams.get('feature') ?? '';
  return NextResponse.json({ data: listOutputs(feature) });
}
