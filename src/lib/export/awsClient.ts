import { postUpload } from './uploadClient';

/** Upload an image blob to S3 via the server proxy; returns the public URL.
 *  Transient gateway/network failures are retried (see postUpload). */
export async function uploadImageToAws(
  blob: Blob,
  key: string,
  shouldStop?: () => boolean,
): Promise<string> {
  return postUpload(
    '/api/aws/upload',
    () => {
      const form = new FormData();
      form.append('file', blob, key.split('/').pop() || 'asset.jpg');
      form.append('key', key);
      return form;
    },
    (data) => (data as { url?: string } | undefined)?.url,
    { label: 'AWS upload', shouldStop },
  );
}
