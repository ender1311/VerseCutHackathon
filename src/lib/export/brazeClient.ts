/** Upload an image blob to the Braze media library via the server proxy. */
export async function uploadImageToBraze(blob: Blob, name: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, `${name}.jpg`);
  form.append('name', name);
  const res = await fetch('/api/braze/upload', { method: 'POST', body: form });
  const json = (await res.json()) as { data?: { url: string }; error?: string; detail?: string };
  if (!res.ok || !json.data) {
    const msg = json.detail ? `${json.error}: ${json.detail}` : json.error;
    throw new Error(msg ?? `Braze upload failed (${res.status})`);
  }
  return json.data.url;
}
