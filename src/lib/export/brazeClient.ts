import { postUpload } from './uploadClient';
import { createPacer } from './rateLimiter';

// Braze media_library/create is capped at 100 requests/hour. Pace uploads to
// stay under it — an initial burst of up to 100, then ~100/hr — so bulk runs
// don't 429-storm. The pacer is module-level so it spans the whole session
// (Braze's quota is account-wide, not per-run). 429s that still slip through
// (e.g. quota already spent by another tool) are retried with Retry-After.
const brazePacer = createPacer(100, 100);
const pace = async () => {
  const wait = brazePacer.reserve(Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
};

/** Upload an image blob to the Braze media library via the server proxy. */
export async function uploadImageToBraze(
  blob: Blob,
  name: string,
  shouldStop?: () => boolean,
): Promise<string> {
  return postUpload(
    '/api/braze/upload',
    () => {
      const form = new FormData();
      form.append('file', blob, `${name}.jpg`);
      form.append('name', name);
      return form;
    },
    (data) => (data as { url?: string } | undefined)?.url,
    { label: 'Braze upload', pace, maxAttempts: 6, shouldStop },
  );
}
