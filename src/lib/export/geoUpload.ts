import { geoAssetPath, countrySlug } from './awsPath';
import { uploadImageToAws } from './awsClient';
import { uploadImageToAir } from './airClient';
import { uploadImageToBraze } from './brazeClient';

export type ExportDestination = 'aws' | 'air' | 'braze';

/**
 * Object key / asset name for one geo photo at the given destination. AWS/AIR
 * use a guard-compatible `versecut/<date>/geo/<slug>_<i>.jpg` key; Braze omits
 * the extension because it derives that from the MIME type itself.
 */
export function geoUploadName(
  dest: ExportDestination,
  dateStr: string,
  country: string,
  index: number,
): string {
  return dest === 'braze'
    ? `versecut/${dateStr}/geo/${countrySlug(country)}_${index}`
    : geoAssetPath(dateStr, country, index, 'jpg');
}

/** Per-destination uploader for a geo background photo; returns the CDN URL. */
export function geoUploaderFor(
  dest: ExportDestination,
  dateStr: string,
): (blob: Blob, country: string, index: number) => Promise<string> {
  const upload =
    dest === 'aws' ? uploadImageToAws : dest === 'braze' ? uploadImageToBraze : uploadImageToAir;
  return (blob, country, index) => upload(blob, geoUploadName(dest, dateStr, country, index));
}

/** Load an image URL and re-encode it to a JPEG blob for upload (browser/canvas). */
export async function imageUrlToJpegBlob(url: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(img, 0, 0);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      0.9,
    ),
  );
}
