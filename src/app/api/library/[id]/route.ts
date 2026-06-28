import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';

// DELETE — remove one of the signed-in user's saved ads (DB row + Blob file).
// Owner-only: a user can only delete their own saved ads.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const ad = await prisma.generatedAd.findUnique({ where: { id } });
  if (!ad || ad.ownerId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Drop the DB row first so a failed Blob delete only leaves an invisible
  // orphaned file (cheap) rather than a row pointing at a dead Blob.
  try {
    await prisma.generatedAd.delete({ where: { id } });
  } catch (err) {
    // P2025 = deleted by a concurrent request; treat delete as idempotent.
    if ((err as { code?: string }).code !== 'P2025') throw err;
  }
  await del(ad.fileUrl).catch(() => {
    /* Blob already gone or unreachable. */
  });
  return Response.json({ data: { id } });
}
