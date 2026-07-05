import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { currentUser } from '@/lib/server/currentUser';
import { isAllowedBlobPath } from '@/lib/server/blob';

// Issues short-lived client-upload tokens so the browser can upload large
// files (rendered video ads, background uploads) directly to Vercel Blob,
// bypassing the serverless request-body size limit.
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The client chooses the pathname; restrict it to our known prefixes so
        // an authed user can't write to arbitrary Blob paths.
        if (!isAllowedBlobPath(pathname)) {
          throw new Error('Disallowed upload path');
        }
        return {
          allowedContentTypes: ['image/png', 'image/jpeg', 'video/mp4', 'video/webm'],
          addRandomSuffix: true,
          maximumSizeInBytes: 200 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        /* metadata is persisted by the client via POST /api/library|uploads */
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'upload failed' },
      { status: 400 },
    );
  }
}
