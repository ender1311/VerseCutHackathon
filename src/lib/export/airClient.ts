import { postUpload } from './uploadClient';

/** Upload an image blob to AIR via the server proxy; returns the CDN URL.
 *  Transient gateway/network failures are retried (see postUpload). */
export async function uploadImageToAir(
  blob: Blob,
  fileName: string,
  shouldStop?: () => boolean,
): Promise<string> {
  return postUpload(
    '/api/air/upload',
    () => {
      const form = new FormData();
      form.append('file', blob, fileName);
      return form;
    },
    (data) => (data as { cdnUrl?: string } | undefined)?.cdnUrl,
    { label: 'AIR upload', shouldStop },
  );
}
