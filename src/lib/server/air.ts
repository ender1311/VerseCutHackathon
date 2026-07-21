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

/** POST that polls through 404 (asset version not yet ready) with capped backoff. */
async function postWhenReady(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Response> {
  const deadline = Date.now() + 45_000;
  let backoff = 350;
  const payload = JSON.stringify(body);
  for (;;) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok || res.status !== 404 || Date.now() >= deadline) return res;
    await sleep(backoff);
    backoff = Math.min(backoff * 1.65, 2750);
  }
}

interface UploadRegistration {
  uploadUrl?: string;
  assetId?: string;
  versionId?: string;
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
    const cdn = (await cdnRes.json()) as { url?: string };
    if (cdn.url) return { cdnUrl: cdn.url };
  }

  const verRes = await fetchImpl(
    `${env.baseUrl}/v1/assets/${reg.assetId}/versions/${reg.versionId}`,
    { headers },
  );
  if (verRes.ok) {
    const ver = (await verRes.json()) as { urls?: { preview?: string; thumbnail?: string } };
    const preview = ver.urls?.preview ?? ver.urls?.thumbnail;
    if (preview) return { cdnUrl: preview };
  }

  return { cdnUrl: `https://air-prod.imgix.net/${reg.versionId}.jpg` };
}
