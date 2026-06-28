import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';

// DELETE — remove a team-shared background asset (DB row + Blob file). Shared
// assets are team-wide, so any signed-in user may curate them.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const asset = await prisma.sharedAsset.findUnique({ where: { id } });
  if (!asset) return Response.json({ data: { id } }); // already gone — idempotent

  // Drop the DB row first so a failed Blob delete only leaves an invisible
  // orphaned file (cheap) rather than a row pointing at a dead Blob.
  try {
    await prisma.sharedAsset.delete({ where: { id } });
  } catch (err) {
    // P2025 = deleted by a concurrent request; treat delete as idempotent.
    if ((err as { code?: string }).code !== 'P2025') throw err;
  }
  await del(asset.fileUrl).catch(() => {
    /* Blob already gone or unreachable. */
  });
  return Response.json({ data: { id } });
}
