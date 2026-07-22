export interface AirEnv {
  apiKey: string;
  workspaceId: string;
  parentBoardId?: string;
  baseUrl: string;
}

export function getAirEnv(): AirEnv | null {
  const apiKey = process.env.AIR_API_KEY;
  const workspaceId = process.env.AIR_WORKSPACE_ID;
  if (!apiKey || !workspaceId) return null;
  return {
    apiKey,
    workspaceId,
    parentBoardId: process.env.AIR_PARENT_BOARD_ID || undefined,
    baseUrl: (process.env.AIR_API_BASE_URL || 'https://api.air.inc').replace(/\/$/, ''),
  };
}

function airHeaders(env: AirEnv): Record<string, string> {
  return { 'x-api-key': env.apiKey, 'x-air-workspace-id': env.workspaceId };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Statuses that mean "retry shortly" for the cdnLinks POST. Right after the S3
// PUT the asset version is often still processing, so AIR answers 404 (version
// not registered yet) or 409 (conflict — not in a linkable state); under a busy
// bulk run we can also hit 429 (rate limit: 15 req/s, 10 concurrent). Every
// other status is terminal — notably 422 "CDN Links are not enabled" and auth
// errors — so the caller can fall back immediately instead of burning the
// whole deadline. This is why versions previously fell back to imgix: only 404
// was retried, so a single 409/429 dropped the real CDN link.
const CDN_RETRYABLE_STATUS = new Set([404, 409, 429]);

/** POST that retries transient not-ready / rate-limited responses with capped backoff. */
async function postWhenReady(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Response> {
  const deadline = Date.now() + 20_000;
  // Start at 1s per AIR's guidance for 429 backoff.
  let backoff = 1000;
  const payload = JSON.stringify(body);
  for (;;) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok || !CDN_RETRYABLE_STATUS.has(res.status) || Date.now() >= deadline) {
      return res;
    }
    await sleep(backoff);
    backoff = Math.min(backoff * 1.65, 3000);
  }
}

interface UploadRegistration {
  uploadUrl?: string;
  assetId?: string;
  versionId?: string;
}

/**
 * Poll the version until its delivery `urls` populate. Right after upload AIR
 * returns 200 with `urls: {}` (or a brief 404) while it processes the asset;
 * the imgix `preview`/`thumbnail` URL appears a few seconds later. Returns that
 * URL, or null if it never becomes ready (caller falls back).
 */
async function getPreviewWhenReady(
  fetchImpl: typeof fetch,
  baseUrl: string,
  assetId: string,
  versionId: string,
  headers: Record<string, string>,
): Promise<string | null> {
  // Bounded so a single asset can't hold the serverless function open too long,
  // especially under concurrent uploads (route maxDuration is 60s).
  const deadline = Date.now() + 12_000;
  let backoff = 500;
  for (;;) {
    const res = await fetchImpl(`${baseUrl}/v1/assets/${assetId}/versions/${versionId}`, {
      headers,
    });
    if (res.ok) {
      const ver = (await res.json().catch(() => null)) as {
        urls?: { preview?: string; image?: string; thumbnail?: string };
      } | null;
      const url = ver?.urls?.preview ?? ver?.urls?.image ?? ver?.urls?.thumbnail;
      if (url) return url;
      // 200 but urls not populated yet (or non-JSON) — keep polling.
    } else if (res.status !== 404) {
      return null;
    }
    if (Date.now() >= deadline) return null;
    await sleep(backoff);
    backoff = Math.min(backoff * 1.5, 3000);
  }
}

export async function uploadToAir(
  bytes: Uint8Array,
  opts: { fileName: string; mime: string; env: AirEnv; fetchImpl?: typeof fetch },
): Promise<{ cdnUrl: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { env } = opts;
  const headers = airHeaders(env);

  const stem = opts.fileName.replace(/\.[^.]+$/, '');
  const ext = opts.fileName.includes('.') ? opts.fileName.split('.').pop()! : '';
  const regBody: Record<string, unknown> = {
    fileName: stem,
    ext,
    size: bytes.byteLength,
    mime: opts.mime,
    recordedAt: '1970-01-01T00:00:00Z',
  };
  if (env.parentBoardId) regBody.parentBoardId = env.parentBoardId;

  const regRes = await fetchImpl(`${env.baseUrl}/v1/uploads`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(regBody),
  });
  if (!regRes.ok) throw new Error(`AIR /v1/uploads failed (${regRes.status})`);
  const reg = (await regRes.json()) as UploadRegistration;
  if (!reg.uploadUrl || !reg.assetId || !reg.versionId) {
    throw new Error('AIR /v1/uploads: missing uploadUrl/assetId/versionId');
  }

  const putRes = await fetchImpl(reg.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': opts.mime },
    body: Buffer.from(bytes),
  });
  if (!putRes.ok) throw new Error(`AIR upload PUT failed (${putRes.status})`);

  const cdnRes = await postWhenReady(
    fetchImpl,
    `${env.baseUrl}/v1/assets/${reg.assetId}/cdnLinks`,
    headers,
    { versionId: reg.versionId },
  );
  if (cdnRes.ok) {
    const cdn = (await cdnRes.json().catch(() => null)) as { url?: string } | null;
    if (cdn?.url) return { cdnUrl: cdn.url };
  }

  const preview = await getPreviewWhenReady(
    fetchImpl,
    env.baseUrl,
    reg.assetId,
    reg.versionId,
    headers,
  );
  if (preview) return { cdnUrl: preview };

  // Last resort: the imgix delivery URL follows this shape once the asset is
  // processed (may 404 briefly if processing hasn't finished). Match the
  // uploaded file's extension so imgix can find the source object.
  const imgixExt = opts.mime === 'image/png' ? 'png' : opts.mime === 'image/webp' ? 'webp' : 'jpg';
  return { cdnUrl: `https://air-prod.imgix.net/${reg.versionId}.${imgixExt}` };
}
