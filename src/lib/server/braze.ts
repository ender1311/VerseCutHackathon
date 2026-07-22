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

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** Ensure the upload filename carries an extension Braze can read (from MIME). */
export function fileNameFor(name: string, mime: string): string {
  const base = name.split('/').pop() ?? name;
  if (/\.[a-z0-9]+$/i.test(base)) return name; // already has an extension
  return `${name}.${MIME_EXT[mime] ?? 'jpg'}`;
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
  // Braze infers the media type from the asset_file filename's extension, not
  // the blob's MIME type — without one it rejects the upload with
  // 400 "unsupported file type". Callers (the bulk export) pass names with no
  // extension, so derive and append one here.
  form.append('asset_file', new Blob([ab], { type: opts.mime }), fileNameFor(opts.name, opts.mime));

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
