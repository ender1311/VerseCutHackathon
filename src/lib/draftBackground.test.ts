import { describe, expect, it } from 'vitest';
import { resolveDraftBackground, type DraftBackgroundSources } from './draftBackground';

function sources(partial: Partial<DraftBackgroundSources> = {}): DraftBackgroundSources {
  return {
    imageFile: null,
    videoFile: null,
    sharedBg: null,
    libraryVideo: null,
    ...partial,
  };
}

describe('resolveDraftBackground', () => {
  it('returns null when nothing is selected', () => {
    expect(resolveDraftBackground(sources())).toBeNull();
  });

  it('prefers image upload over everything else', () => {
    const imageFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const result = resolveDraftBackground(
      sources({
        imageFile,
        videoFile: new File(['y'], 'clip.mp4', { type: 'video/mp4' }),
        sharedBg: { url: 'https://example.com/shared.jpg', label: 'Shared', kind: 'image' },
        libraryVideo: { url: 'https://example.com/lib.mp4' },
      }),
      { image: 'blob:image', video: 'blob:video' },
    );
    expect(result).toEqual({ kind: 'image', url: 'blob:image', label: 'photo.jpg' });
  });

  it('prefers video upload over shared and library video', () => {
    const videoFile = new File(['y'], 'clip.mp4', { type: 'video/mp4' });
    const result = resolveDraftBackground(
      sources({
        videoFile,
        sharedBg: { url: 'https://example.com/shared.jpg', label: 'Shared', kind: 'image' },
        libraryVideo: { url: 'https://example.com/lib.mp4' },
      }),
      { video: 'blob:video' },
    );
    expect(result).toEqual({ kind: 'video', url: 'blob:video', label: 'clip.mp4' });
  });

  it('uses sharedBg when no uploads are set', () => {
    const result = resolveDraftBackground(
      sources({
        sharedBg: {
          url: 'https://example.com/bg.jpg',
          label: 'Movie Town',
          kind: 'image',
        },
        libraryVideo: { url: 'https://example.com/lib.mp4' },
      }),
    );
    expect(result).toEqual({
      kind: 'image',
      url: 'https://example.com/bg.jpg',
      label: 'Movie Town',
    });
  });

  it('uses sharedBg video kind', () => {
    const result = resolveDraftBackground(
      sources({
        sharedBg: {
          url: 'https://example.com/bg.mp4',
          label: 'Pexels · Clip',
          kind: 'video',
        },
      }),
    );
    expect(result).toEqual({
      kind: 'video',
      url: 'https://example.com/bg.mp4',
      label: 'Pexels · Clip',
    });
  });

  it('falls back to libraryVideo', () => {
    const result = resolveDraftBackground(
      sources({ libraryVideo: { url: 'https://example.com/lib.mp4' } }),
    );
    expect(result).toEqual({ kind: 'video', url: 'https://example.com/lib.mp4' });
  });

  it('skips imageFile when no object URL is provided', () => {
    const imageFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const result = resolveDraftBackground(
      sources({
        imageFile,
        sharedBg: { url: 'https://example.com/shared.jpg', label: 'Shared', kind: 'image' },
      }),
    );
    expect(result).toEqual({
      kind: 'image',
      url: 'https://example.com/shared.jpg',
      label: 'Shared',
    });
  });
});
