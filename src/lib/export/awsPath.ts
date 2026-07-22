export interface VerseRef {
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

/** Verse slug for folder/name organization, e.g. "jhn3_16" or "1jn4_7-8". */
export function refSlug(ref: VerseRef): string {
  const book = ref.bookId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const range = ref.fromVerse === ref.toVerse ? `${ref.fromVerse}` : `${ref.fromVerse}-${ref.toVerse}`;
  return `${book}${ref.chapter}_${range}`;
}

/**
 * Per-run export folder, organized by date then verse reference, e.g.
 * "versecut/2026-07-21/jhn3_16". Used as the S3 key prefix, and as the
 * name/title prefix for AIR and Braze so every destination groups a run's
 * assets together.
 */
export function exportFolder(dateStr: string, ref: VerseRef): string {
  return `versecut/${dateStr}/${refSlug(ref)}`;
}

/** Full object key/path for one version's asset within an export folder. */
export function exportAssetPath(
  dateStr: string,
  ref: VerseRef,
  versionId: string,
  ext = 'jpg',
): string {
  return `${exportFolder(dateStr, ref)}/${versionId}.${ext}`;
}

/** Filesystem-safe slug for a country name, e.g. "South Africa" -> "south-africa". */
export function countrySlug(country: string): string {
  return country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Object key/path for one geo background photo, e.g.
 * "versecut/2026-07-22/geo/south-africa_0.jpg". Kept in the `versecut/<date>/`
 * shape so it passes the export-key guard shared with the version export.
 */
export function geoAssetPath(dateStr: string, country: string, index: number, ext = 'jpg'): string {
  return `versecut/${dateStr}/geo/${countrySlug(country)}_${index}.${ext}`;
}

/** Public URL for an object. Uses `base` (e.g. a CloudFront domain) when set, else the S3 path style. */
export function publicS3Url(bucket: string, key: string, base?: string | null): string {
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `https://s3.amazonaws.com/${bucket}/${key}`;
}
