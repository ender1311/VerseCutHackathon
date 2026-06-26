import { describe, expect, it } from 'vitest';
import { proxyMedia } from './videoLibrary';

describe('proxyMedia', () => {
  it('rewrites the CDN host to the same-origin media proxy', () => {
    expect(
      proxyMedia('https://yv-content-assets.youversionapi.com/delivery/videos/abc/high.webm'),
    ).toBe('/yvmedia/delivery/videos/abc/high.webm');
  });
  it('leaves non-CDN urls unchanged', () => {
    expect(proxyMedia('https://example.com/x.mp4')).toBe('https://example.com/x.mp4');
  });
  it('returns undefined for empty input', () => {
    expect(proxyMedia(null)).toBeUndefined();
    expect(proxyMedia(undefined)).toBeUndefined();
  });
});
