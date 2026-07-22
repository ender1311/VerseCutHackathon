import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  prefsKey,
  loadBulkExportPrefs,
  saveBulkExportPrefs,
  type BulkExportPrefs,
} from './bulkExportPrefs';

const PREFS: BulkExportPrefs = {
  bookId: 'JHN',
  chapter: 3,
  fromVerse: 16,
  toVerse: 16,
  logoStyle: 'logo-light',
  aspect: '16:9',
  limit: 3,
  destination: 'aws',
  exportType: 'versions',
  gradientId: 'ocean',
  customColor: null,
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('bulkExportPrefs', () => {
  it('namespaces the key per user', () => {
    expect(prefsKey('a@x.com')).not.toBe(prefsKey('b@x.com'));
    expect(prefsKey(null)).toBe('versecut:bulkExport:anon');
  });

  it('round-trips saved settings for a user', () => {
    saveBulkExportPrefs('dan@x.com', PREFS);
    expect(loadBulkExportPrefs('dan@x.com')).toEqual(PREFS);
  });

  it('keeps settings isolated between users', () => {
    saveBulkExportPrefs('dan@x.com', PREFS);
    expect(loadBulkExportPrefs('sam@x.com')).toBeNull();
  });

  it('returns null for missing or malformed data', () => {
    expect(loadBulkExportPrefs('nobody@x.com')).toBeNull();
    localStorage.setItem(prefsKey('bad@x.com'), '{not json');
    expect(loadBulkExportPrefs('bad@x.com')).toBeNull();
  });
});
