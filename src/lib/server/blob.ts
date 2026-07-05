// Blob pathnames the client is allowed to upload to. The client picks the
// pathname in the upload-token flow, so restrict it to our known prefixes (and
// block traversal) rather than letting an authed user write anywhere.
const ALLOWED_BLOB_PREFIXES = ['ads/', 'shared/', 'product/', 'verse-images/'];

export function isAllowedBlobPath(pathname: string): boolean {
  if (typeof pathname !== 'string' || pathname.includes('..')) return false;
  return ALLOWED_BLOB_PREFIXES.some((p) => pathname.startsWith(p));
}

// Validates that a client-supplied fileUrl is one of our own Vercel Blob URLs
// before we persist it. Without this, a caller could register a DB row pointing
// at an arbitrary external URL (which later flows into del() on deletion).
export function isManagedBlobUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}
