import { NextResponse } from 'next/server';
import { listFeatures, pmEnabled } from '@/lib/server/pm';

export const runtime = 'nodejs';

export async function GET() {
  if (!pmEnabled()) {
    return NextResponse.json({ error: 'Product Marketing builds run only in local dev' }, { status: 403 });
  }
  return NextResponse.json({ data: listFeatures() });
}
