export interface BrazeEnv {
  apiKey: string;
  restEndpoint: string;
}

export function getBrazeEnv(): BrazeEnv | null {
  const apiKey = process.env.BRAZE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    restEndpoint: (process.env.BRAZE_REST_ENDPOINT || 'https://rest.iad-01.braze.com').replace(/\/$/, ''),
  };
}

interface BrazeCreateResponse {
  new_assets?: { name?: string; url?: string; ext?: string; size?: number }[];
  errors?: unknown[];
  message?: string;
}

/**
 * Upload an image to the Braze media library via POST /media_library/create
 * (multipart `asset_file`). Returns the Braze-hosted asset URL.
 * Requires a REST API key with the `media_library.create` permission.
 */
export async function uploadToBraze(
  bytes: Uint8Array,
  opts: { name: string; mime: string; env: BrazeEnv; fetchImpl?: typeof fetch },
): Promise<{ url: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  // Copy into a plain ArrayBuffer so Blob's typing (ArrayBuffer, not the wider
  // ArrayBufferLike/SharedArrayBuffer) is satisfied.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const form = new FormData();
  form.append('name', opts.name);
  form.append('asset_file', new Blob([ab], { type: opts.mime }), opts.name);

  const res = await fetchImpl(`${opts.env.restEndpoint}/media_library/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.env.apiKey}` },
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as BrazeCreateResponse;
  if (!res.ok) {
    throw new Error(`Braze media_library/create ${res.status}: ${body.message ?? 'request failed'}`);
  }
  const url = body.new_assets?.[0]?.url;
  if (!url) {
    const detail = body.message ?? (body.errors ? JSON.stringify(body.errors) : 'no asset url returned');
    throw new Error(`Braze media_library/create returned no asset url: ${detail}`);
  }
  return { url };
}
