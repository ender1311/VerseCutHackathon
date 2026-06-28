import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { isManagedBlobUrl } from '@/lib/server/blob';

// GET — the signed-in user's saved ads (newest first).
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const ads = await prisma.generatedAd.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return Response.json({ data: ads });
}

// POST — save a rendered ad's metadata (file already uploaded to Blob).
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json();
  if (!b?.fileUrl || !b?.format || !b?.aspect) {
    return Response.json({ error: 'fileUrl, format, aspect required' }, { status: 400 });
  }
  if (!isManagedBlobUrl(b.fileUrl)) {
    return Response.json({ error: 'fileUrl must be a managed Blob URL' }, { status: 400 });
  }
  const ad = await prisma.generatedAd.create({
    data: {
      ownerId: user.id,
      ownerEmail: user.email,
      title: b.title ?? null,
      format: String(b.format),
      aspect: String(b.aspect),
      language: b.language ?? null,
      reference: b.reference ?? null,
      versionAbbr: b.versionAbbr ?? null,
      fileUrl: String(b.fileUrl),
      mime: b.mime ?? null,
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : null,
    },
  });
  return Response.json({ data: ad }, { status: 201 });
}
