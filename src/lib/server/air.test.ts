import { describe, expect, it, vi } from 'vitest';
import { uploadToAir, type AirEnv } from './air';

const ENV: AirEnv = {
  apiKey: 'k',
  workspaceId: 'w',
  baseUrl: 'https://api.air.inc',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('uploadToAir', () => {
  it('registers, PUTs bytes, creates a cdn link, and returns the cdn url', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? 'GET'} ${u}`);
      if (u.endsWith('/v1/uploads')) {
        return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v1' });
      }
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) return jsonResponse({ id: 'c1', url: 'https://cdn.air/x.jpg' });
      if (u.includes('/versions/')) return jsonResponse({ urls: { preview: 'https://prev/x.jpg' } });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1, 2, 3]), {
      fileName: 'v1.png',
      mime: 'image/png',
      env: ENV,
      fetchImpl,
    });
    expect(res.cdnUrl).toBe('https://cdn.air/x.jpg');
    expect(calls[0]).toBe('POST https://api.air.inc/v1/uploads');
    expect(calls[1]).toBe('PUT https://s3/put');
  });

  it('falls back to the imgix version URL when no cdn link is returned', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v9' });
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) return jsonResponse({}, 500);
      if (u.includes('/versions/')) return jsonResponse({}, 500);
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1]), { fileName: 'v9.png', mime: 'image/png', env: ENV, fetchImpl });
    // Fallback extension is derived from the mime type.
    expect(res.cdnUrl).toBe('https://air-prod.imgix.net/v9.png');
  });

  it('retries the cdn link POST while the asset version is still processing (404/409)', async () => {
    vi.useFakeTimers();
    try {
      let cdnCalls = 0;
      const fetchImpl = vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v3' });
        if (u === 'https://s3/put') return new Response(null, { status: 200 });
        if (u.includes('/cdnLinks')) {
          cdnCalls++;
          // Not-found then conflict (still processing), then the link is minted.
          if (cdnCalls === 1) return jsonResponse({}, 404);
          if (cdnCalls === 2) return jsonResponse({}, 409);
          return jsonResponse({ url: 'https://cdn.air/v3.jpg' });
        }
        return jsonResponse({}, 404);
      }) as unknown as typeof fetch;

      const p = uploadToAir(new Uint8Array([1]), { fileName: 'v3.jpg', mime: 'image/jpeg', env: ENV, fetchImpl });
      await vi.runAllTimersAsync();
      const res = await p;
      expect(res.cdnUrl).toBe('https://cdn.air/v3.jpg');
      expect(cdnCalls).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries the cdn link POST when rate limited (429)', async () => {
    vi.useFakeTimers();
    try {
      let cdnCalls = 0;
      const fetchImpl = vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v4' });
        if (u === 'https://s3/put') return new Response(null, { status: 200 });
        if (u.includes('/cdnLinks')) {
          cdnCalls++;
          return cdnCalls === 1
            ? jsonResponse({ message: 'Too Many Requests' }, 429)
            : jsonResponse({ url: 'https://cdn.air/v4.jpg' });
        }
        return jsonResponse({}, 404);
      }) as unknown as typeof fetch;

      const p = uploadToAir(new Uint8Array([1]), { fileName: 'v4.jpg', mime: 'image/jpeg', env: ENV, fetchImpl });
      await vi.runAllTimersAsync();
      const res = await p;
      expect(res.cdnUrl).toBe('https://cdn.air/v4.jpg');
      expect(cdnCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry cdn links when the feature is disabled (422) — falls back immediately', async () => {
    let cdnCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v5' });
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) {
        cdnCalls++;
        return jsonResponse({ error: 'CDN Links are not enabled' }, 422);
      }
      if (u.includes('/versions/')) return jsonResponse({ urls: { preview: 'https://prev/v5.jpg' } });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1]), { fileName: 'v5.jpg', mime: 'image/jpeg', env: ENV, fetchImpl });
    expect(res.cdnUrl).toBe('https://prev/v5.jpg');
    expect(cdnCalls).toBe(1); // 422 is terminal — no retry loop
  });

  it('polls the version until urls populate when cdn links are disabled', async () => {
    let versionCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v2' });
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) return jsonResponse({ error: 'CDN Links are not enabled' }, 422);
      if (u.includes('/versions/')) {
        versionCalls++;
        // First read: processed but urls not ready yet. Second read: ready.
        return versionCalls < 2
          ? jsonResponse({ urls: {} })
          : jsonResponse({ urls: { thumbnail: 'https://air-prod.imgix.net/v2.jpg', preview: 'https://air-prod.imgix.net/v2.jpg' } });
      }
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1]), { fileName: 'v2.jpg', mime: 'image/jpeg', env: ENV, fetchImpl });
    expect(res.cdnUrl).toBe('https://air-prod.imgix.net/v2.jpg');
    expect(versionCalls).toBeGreaterThanOrEqual(2);
  });
});
