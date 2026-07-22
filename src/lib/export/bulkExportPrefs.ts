// Per-user persistence of the Bulk Export form settings (localStorage).

export interface BulkExportPrefs {
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
  logoStyle: string;
  aspect: string;
  limit: number;
  destination: string;
  exportType: string;
  gradientId: string | null;
  customColor: string | null;
}

const KEY_PREFIX = 'versecut:bulkExport:';

/** Storage key namespaced per user so each account keeps its own settings. */
export function prefsKey(userEmail: string | null | undefined): string {
  return `${KEY_PREFIX}${userEmail || 'anon'}`;
}

export function loadBulkExportPrefs(
  userEmail: string | null | undefined,
): Partial<BulkExportPrefs> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(prefsKey(userEmail));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<BulkExportPrefs>) : null;
  } catch {
    return null;
  }
}

export function saveBulkExportPrefs(
  userEmail: string | null | undefined,
  prefs: BulkExportPrefs,
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(prefsKey(userEmail), JSON.stringify(prefs));
  } catch {
    /* quota/unavailable — ignore */
  }
}
