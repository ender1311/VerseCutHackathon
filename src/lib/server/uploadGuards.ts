// Shared input validation for the AIR/AWS/Braze upload routes.

/** Max accepted upload size (Braze caps images at 5 MB; keep headroom below that upstream limit elsewhere). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadReject {
  ok: false;
  status: number;
  error: string;
}
export interface UploadOk {
  ok: true;
}

/** Validate an uploaded File: must be a File, within size, and an allowed image type. */
export function validateUploadFile(file: unknown): UploadOk | UploadReject {
  if (!(file instanceof File)) {
    return { ok: false, status: 400, error: 'file field is required' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: `file exceeds ${MAX_UPLOAD_BYTES} bytes` };
  }
  const mime = file.type || 'image/jpeg';
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, status: 415, error: `unsupported content type: ${mime}` };
  }
  return { ok: true };
}

/**
 * S3 object keys must match the app's export shape and never traverse or contain
 * control chars. Prevents a client from overwriting arbitrary bucket objects.
 * e.g. versecut/2026-07-21/jhn3_16/111.jpg
 */
const EXPORT_KEY_RE = /^versecut\/\d{4}-\d{2}-\d{2}\/[a-z0-9_-]+\/[A-Za-z0-9._-]+$/;

export function isValidExportKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    key.length <= 256 &&
    !key.includes('..') &&
    EXPORT_KEY_RE.test(key)
  );
}
