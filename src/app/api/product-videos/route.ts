import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { isManagedBlobUrl } from '@/lib/server/blob';

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await prisma.productVideo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return Response.json({ data });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json();
  const required = ['feature', 'title', 'length', 'lang', 'orientation', 'fileUrl'] as const;
  for (const k of required) {
    if (!b?.[k]) return Response.json({ error: `${k} required` }, { status: 400 });
  }
  if (!isManagedBlobUrl(b.fileUrl)) {
    return Response.json({ error: 'fileUrl must be a managed Blob URL' }, { status: 400 });
  }
  const row = await prisma.productVideo.create({
    data: {
      ownerId: user.id,
      ownerEmail: user.email,
      feature: String(b.feature),
      title: String(b.title),
      length: String(b.length),
      lang: String(b.lang),
      orientation: String(b.orientation),
      fileUrl: String(b.fileUrl),
      mime: b.mime ?? 'video/mp4',
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : null,
    },
  });
  return Response.json({ data: row }, { status: 201 });
}
