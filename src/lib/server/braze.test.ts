import { describe, expect, it, vi } from 'vitest';
import { fileNameFor, uploadToBraze, type BrazeEnv } from './braze';

const ENV: BrazeEnv = { apiKey: 'k', restEndpoint: 'https://rest.braze.example' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('fileNameFor', () => {
  it('appends an extension derived from the MIME type when missing', () => {
    expect(fileNameFor('versecut/2026-07-21/jhn3_16/111', 'image/jpeg')).toBe(
      'versecut/2026-07-21/jhn3_16/111.jpg',
    );
    expect(fileNameFor('a/b/c', 'image/png')).toBe('a/b/c.png');
    expect(fileNameFor('a/b/c', 'image/webp')).toBe('a/b/c.webp');
  });

  it('defaults to jpg for unknown MIME types', () => {
    expect(fileNameFor('a/b/c', 'application/octet-stream')).toBe('a/b/c.jpg');
  });

  it('leaves a name that already has an extension untouched', () => {
    expect(fileNameFor('a/b/c.png', 'image/jpeg')).toBe('a/b/c.png');
  });

  it('only considers the last path segment for an existing extension', () => {
    // Dotted folder, extensionless leaf → still needs an extension.
    expect(fileNameFor('v1.2/asset', 'image/jpeg')).toBe('v1.2/asset.jpg');
  });
});

describe('uploadToBraze', () => {
  it('uploads asset_file with an extensioned filename so Braze accepts it', async () => {
    let capturedName: string | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const form = init!.body as FormData;
      capturedName = (form.get('asset_file') as File).name;
      return jsonResponse({ new_assets: [{ url: 'https://braze-images.com/x.jpg' }] });
    }) as unknown as typeof fetch;

    const res = await uploadToBraze(new Uint8Array([1, 2, 3]), {
      name: 'versecut/2026-07-21/jhn3_16/111',
      mime: 'image/jpeg',
      env: ENV,
      fetchImpl,
    });
    expect(res.url).toBe('https://braze-images.com/x.jpg');
    expect(capturedName).toBe('versecut/2026-07-21/jhn3_16/111.jpg');
  });

  it('throws with detail when Braze returns an error', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'unsupported file type' }, 400),
    ) as unknown as typeof fetch;
    await expect(
      uploadToBraze(new Uint8Array([1]), { name: 'a/b', mime: 'image/jpeg', env: ENV, fetchImpl }),
    ).rejects.toThrow(/unsupported file type/);
  });
});
