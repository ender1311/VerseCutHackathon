import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { pmEnabled, resolveOutputPath } from '@/lib/server/pm';
import { parseOutputName } from '@/lib/productVideo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!pmEnabled()) {
    return Response.json({ error: 'Publishing runs only in local dev' }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await request.json();
  const feature = String(b?.feature ?? '');
  const name = String(b?.name ?? '');
  const filePath = resolveOutputPath(feature, name);
  if (!filePath) return Response.json({ error: 'Unknown output' }, { status: 400 });
  const meta = parseOutputName(name);
  if (!meta) return Response.json({ error: 'Unparseable output name' }, { status: 400 });

  const bytes = readFileSync(filePath);
  const blob = await put(`product/${feature}/${basename(name)}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'video/mp4',
  });

  let row;
  try {
    row = await prisma.productVideo.create({
      data: {
        ownerId: user.id,
        ownerEmail: user.email,
        feature,
        title: name.replace(/\.mp4$/, ''),
        length: meta.length,
        lang: meta.lang,
        orientation: meta.orientation,
        fileUrl: blob.url,
        mime: 'video/mp4',
        sizeBytes: bytes.length,
      },
    });
  } catch (e) {
    // Don't orphan the uploaded Blob if the DB row can't be written.
    await del(blob.url).catch(() => {});
    throw e;
  }
  return Response.json({ data: row }, { status: 201 });
}
