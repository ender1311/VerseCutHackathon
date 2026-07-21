export interface VerseRef {
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

/** Deterministic S3 key for a version's rendered asset (re-runs overwrite). */
export function s3KeyForVersion(ref: VerseRef, versionId: string, ext = 'jpg'): string {
  const book = ref.bookId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const range = ref.fromVerse === ref.toVerse ? `${ref.fromVerse}` : `${ref.fromVerse}-${ref.toVerse}`;
  return `versecut/${book}${ref.chapter}_${range}/${versionId}.${ext}`;
}

/** Public URL for an object. Uses `base` (e.g. a CloudFront domain) when set, else the S3 path style. */
export function publicS3Url(bucket: string, key: string, base?: string | null): string {
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `https://s3.amazonaws.com/${bucket}/${key}`;
}
