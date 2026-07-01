import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await prisma.productVideo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return Response.json({ data });
}
