import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { isManagedBlobUrl } from '@/lib/server/blob';

// GET — shared background assets uploaded by anyone (any user can reuse them).
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const assets = await prisma.sharedAsset.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  return Response.json({ data: assets });
}

// POST — register a shared upload (file already uploaded to Blob).
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json();
  if (!b?.fileUrl || !b?.kind || !b?.name) {
    return Response.json({ error: 'fileUrl, kind, name required' }, { status: 400 });
  }
  if (!isManagedBlobUrl(b.fileUrl)) {
    return Response.json({ error: 'fileUrl must be a managed Blob URL' }, { status: 400 });
  }
  const asset = await prisma.sharedAsset.create({
    data: {
      ownerId: user.id,
      ownerEmail: user.email,
      kind: String(b.kind),
      name: String(b.name),
      fileUrl: String(b.fileUrl),
      mime: b.mime ?? null,
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : null,
    },
  });
  return Response.json({ data: asset }, { status: 201 });
}
