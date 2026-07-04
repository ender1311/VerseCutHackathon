import { describe, expect, it } from 'vitest';
import { baseContentType } from './library';

describe('baseContentType', () => {
  it('strips codec parameters from a MediaRecorder MIME', () => {
    expect(baseContentType('video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'mp4')).toBe('video/mp4');
    expect(baseContentType('video/webm;codecs=vp8,opus', 'webm')).toBe('video/webm');
  });
  it('passes clean image types through', () => {
    expect(baseContentType('image/png', 'png')).toBe('image/png');
    expect(baseContentType('image/jpeg', 'jpg')).toBe('image/jpeg');
  });
  it('falls back by extension when the blob has no type', () => {
    expect(baseContentType('', 'mp4')).toBe('video/mp4');
    expect(baseContentType('', 'webm')).toBe('video/webm');
    expect(baseContentType('', 'jpg')).toBe('image/jpeg');
    expect(baseContentType('', 'png')).toBe('image/png');
  });
});
