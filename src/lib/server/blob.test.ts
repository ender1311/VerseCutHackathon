import { describe, expect, it } from 'vitest';
import { isManagedBlobUrl } from './blob';

describe('isManagedBlobUrl', () => {
  it('accepts our Vercel Blob URLs', () => {
    expect(
      isManagedBlobUrl('https://abc123.public.blob.vercel-storage.com/shared/x.png'),
    ).toBe(true);
  });

  it('rejects arbitrary or non-blob hosts', () => {
    expect(isManagedBlobUrl('https://evil.com/x.png')).toBe(false);
    expect(isManagedBlobUrl('https://blob.vercel-storage.com.evil.com/x')).toBe(false);
    expect(isManagedBlobUrl('http://abc.public.blob.vercel-storage.com/x')).toBe(false); // not https
  });

  it('rejects non-string / unparseable input', () => {
    expect(isManagedBlobUrl(undefined)).toBe(false);
    expect(isManagedBlobUrl(123)).toBe(false);
    expect(isManagedBlobUrl('not a url')).toBe(false);
  });
});
