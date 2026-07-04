// Client helpers for the asset library. Files upload directly to Vercel Blob
// (via the /api/blob/upload token route), then metadata is persisted to the DB.
import { upload } from '@vercel/blob/client';
import type { RenderedAsset } from './render';

export interface SavedAd {
  id: string;
  createdAt: string;
  title: string | null;
  format: string;
  aspect: string;
  language: string | null;
  reference: string | null;
  versionAbbr: string | null;
  fileUrl: string;
}

export interface AdMeta {
  title?: string;
  format: 'image' | 'video';
  aspect: string;
  language?: string | null;
  reference?: string | null;
  versionAbbr?: string | null;
}

function fileName(meta: AdMeta, ext: string): string {
  const ref = (meta.reference ?? 'verse').replace(/[^\w.-]+/g, '-').toLowerCase();
  return `ads/${ref}-${meta.aspect.replace(':', 'x')}.${ext}`;
}

/**
 * Strip codec/parameter suffixes from a MIME type (e.g.
 * `video/mp4;codecs="avc1.42E01E,mp4a.40.2"` → `video/mp4`). MediaRecorder-
 * produced blobs carry a codecs parameter that the Blob upload token's
 * `allowedContentTypes` allowlist won't match, which fails the save. Falls back
 * to a sensible default when the blob has no type.
 */
export function baseContentType(type: string, ext: string): string {
  const base = type.split(';')[0].trim().toLowerCase();
  if (base) return base;
  return ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : `image/${ext === 'jpg' ? 'jpeg' : 'png'}`;
}

/** Upload a rendered asset to Blob, then persist its metadata. */
export async function saveAdToLibrary(asset: RenderedAsset, meta: AdMeta): Promise<SavedAd> {
  const contentType = baseContentType(asset.blob.type, asset.ext);
  const blob = await upload(fileName(meta, asset.ext), asset.blob, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
    contentType,
  });
  const res = await fetch('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...meta,
      fileUrl: blob.url,
      mime: contentType,
      sizeBytes: asset.blob.size,
    }),
  });
  if (!res.ok) throw new Error('Failed to save to library');
  return (await res.json()).data as SavedAd;
}

export async function listMyAds(): Promise<SavedAd[]> {
  const res = await fetch('/api/library');
  if (!res.ok) throw new Error('Failed to load library');
  return (await res.json()).data as SavedAd[];
}

/** Delete one of the signed-in user's saved ads (DB row + Blob file). */
export async function deleteMyAd(id: string): Promise<void> {
  const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}

// --- Shared background assets (uploaded once, reusable by everyone) ----------

export interface SharedAsset {
  id: string;
  createdAt: string;
  kind: 'image' | 'video';
  name: string;
  fileUrl: string;
  source?: string | null;
  language?: string | null;
  category?: string | null;
  orientation?: string | null;
  audience?: string | null;
}

export async function listSharedAssets(): Promise<SharedAsset[]> {
  const res = await fetch('/api/uploads');
  if (!res.ok) throw new Error('Failed to load shared assets');
  return (await res.json()).data as SharedAsset[];
}

/** Upload a background to Blob and register it as a team-shared asset. */
export async function uploadSharedAsset(file: File): Promise<SharedAsset> {
  const kind: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
  const safe = file.name.replace(/[^\w.-]+/g, '-');
  const contentType = baseContentType(file.type, kind === 'video' ? 'mp4' : 'png');
  const blob = await upload(`shared/${safe}`, file, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
    contentType,
  });
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      name: file.name,
      fileUrl: blob.url,
      mime: contentType,
      sizeBytes: file.size,
    }),
  });
  if (!res.ok) throw new Error('Failed to share asset');
  return (await res.json()).data as SharedAsset;
}

/** Remove a team-shared asset (DB row + Blob file). */
export async function deleteSharedAsset(id: string): Promise<void> {
  const res = await fetch(`/api/uploads/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove asset');
}
