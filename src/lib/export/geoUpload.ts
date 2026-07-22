import { geoAssetPath, countrySlug } from './awsPath';
import { uploadImageToAws } from './awsClient';
import { uploadImageToAir } from './airClient';
import { uploadImageToBraze } from './brazeClient';

export type ExportDestination = 'aws' | 'air' | 'braze';

/**
 * Object key / asset name for one localized geo image at the given destination,
 * keyed by country + language so per-language images don't collide. AWS/AIR use
 * a guard-compatible `versecut/<date>/geo/<slug>_<lang>.jpg` key; Braze omits the
 * extension because it derives that from the MIME type itself.
 */
export function geoUploadName(
  dest: ExportDestination,
  dateStr: string,
  country: string,
  langCode: string,
): string {
  return dest === 'braze'
    ? `versecut/${dateStr}/geo/${countrySlug(country)}_${langCode}`
    : geoAssetPath(dateStr, country, langCode, 'jpg');
}

/** Per-destination uploader for a localized geo image; returns the CDN URL. */
export function geoUploaderFor(
  dest: ExportDestination,
  dateStr: string,
  shouldStop?: () => boolean,
): (blob: Blob, country: string, langCode: string) => Promise<string> {
  const upload =
    dest === 'aws' ? uploadImageToAws : dest === 'braze' ? uploadImageToBraze : uploadImageToAir;
  return (blob, country, langCode) =>
    upload(blob, geoUploadName(dest, dateStr, country, langCode), shouldStop);
}
