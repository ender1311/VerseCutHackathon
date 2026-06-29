import { NextResponse } from 'next/server';
import { getJob, pmEnabled } from '@/lib/server/pm';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!pmEnabled()) {
    return NextResponse.json({ error: 'Product Marketing builds run only in local dev' }, { status: 403 });
  }
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Unknown job' }, { status: 404 });
  return NextResponse.json({ data: job });
}
