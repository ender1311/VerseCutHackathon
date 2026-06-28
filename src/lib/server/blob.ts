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
