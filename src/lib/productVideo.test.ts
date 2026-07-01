import { describe, expect, it } from 'vitest';
import { parseOutputName } from './productVideo';

describe('parseOutputName', () => {
  it('parses a short en portrait name', () => {
    expect(parseOutputName('reading-plans-short-en-portrait.mp4')).toEqual({
      length: 'short', lang: 'en', orientation: 'portrait',
    });
  });
  it('parses a long es landscape name', () => {
    expect(parseOutputName('reading-plans-long-es-landscape.mp4')).toEqual({
      length: 'long', lang: 'es', orientation: 'landscape',
    });
  });
  it('returns null for non-matching names', () => {
    expect(parseOutputName('reading-plans.mp4')).toBeNull();
    expect(parseOutputName('foo-medium-en-portrait.mp4')).toBeNull();
    expect(parseOutputName('not-a-video.txt')).toBeNull();
  });
});
