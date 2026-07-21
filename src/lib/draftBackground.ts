/** Live draft media shown in Preview before a render job exists. */
export interface DraftBackground {
  kind: 'image' | 'video';
  url: string;
  label?: string;
}

export interface DraftBackgroundSources {
  imageFile: File | null;
  videoFile: File | null;
  sharedBg: { url: string; label: string; kind: 'image' | 'video' } | null;
  libraryVideo: { url: string } | null;
}

/**
 * Resolve which background to show as a live draft preview.
 * Priority mirrors the sidebar / generate snapshot: upload image → upload
 * video → shared (YouVersion / Unsplash / video library) → libraryVideo.
 *
 * For File sources the caller must supply object URLs (and revoke them).
 */
export function resolveDraftBackground(
  sources: DraftBackgroundSources,
  fileUrls: { image?: string | null; video?: string | null } = {},
): DraftBackground | null {
  if (sources.imageFile && fileUrls.image) {
    return {
      kind: 'image',
      url: fileUrls.image,
      label: sources.imageFile.name,
    };
  }
  if (sources.videoFile && fileUrls.video) {
    return {
      kind: 'video',
      url: fileUrls.video,
      label: sources.videoFile.name,
    };
  }
  if (sources.sharedBg) {
    return {
      kind: sources.sharedBg.kind,
      url: sources.sharedBg.url,
      label: sources.sharedBg.label,
    };
  }
  if (sources.libraryVideo) {
    return { kind: 'video', url: sources.libraryVideo.url };
  }
  return null;
}
