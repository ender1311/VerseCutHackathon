/** Upload an image blob to S3 via the server proxy; returns the public URL. */
export async function uploadImageToAws(blob: Blob, key: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, key.split('/').pop() || 'asset.jpg');
  form.append('key', key);
  const res = await fetch('/api/aws/upload', { method: 'POST', body: form });
  const json = (await res.json()) as { data?: { url: string }; error?: string; detail?: string };
  if (!res.ok || !json.data) {
    const msg = json.detail ? `${json.error}: ${json.detail}` : json.error;
    throw new Error(msg ?? `AWS upload failed (${res.status})`);
  }
  return json.data.url;
}
