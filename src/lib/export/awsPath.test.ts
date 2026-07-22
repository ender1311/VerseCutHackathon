import { describe, expect, it } from 'vitest';
import {
  refSlug,
  exportFolder,
  exportAssetPath,
  publicS3Url,
  countrySlug,
  geoAssetPath,
} from '@/lib/export/awsPath';
import { isValidExportKey } from '@/lib/server/uploadGuards';

const JHN = { bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 };
const RANGE = { bookId: '1JN', chapter: 4, fromVerse: 7, toVerse: 8 };

describe('refSlug', () => {
  it('sanitizes book + chapter + single verse', () => {
    expect(refSlug(JHN)).toBe('jhn3_16');
  });
  it('encodes a verse range', () => {
    expect(refSlug(RANGE)).toBe('1jn4_7-8');
  });
});

describe('exportFolder', () => {
  it('organizes by date then verse reference', () => {
    expect(exportFolder('2026-07-21', JHN)).toBe('versecut/2026-07-21/jhn3_16');
  });
});

describe('exportAssetPath', () => {
  it('builds the per-version object path under the dated folder', () => {
    expect(exportAssetPath('2026-07-21', JHN, '111')).toBe('versecut/2026-07-21/jhn3_16/111.jpg');
  });
});

describe('countrySlug', () => {
  it('lowercases and hyphenates, trimming stray separators', () => {
    expect(countrySlug('South Africa')).toBe('south-africa');
    expect(countrySlug('Côte d’Ivoire')).toBe('c-te-d-ivoire');
    expect(countrySlug('  Spain  ')).toBe('spain');
  });
});

describe('geoAssetPath', () => {
  it('builds a geo photo key under the dated folder', () => {
    expect(geoAssetPath('2026-07-22', 'South Africa', 0)).toBe(
      'versecut/2026-07-22/geo/south-africa_0.jpg',
    );
  });
  it('produces keys that pass the export-key guard', () => {
    expect(isValidExportKey(geoAssetPath('2026-07-22', 'United States', 2))).toBe(true);
    expect(isValidExportKey(geoAssetPath('2026-07-22', 'France', 1, 'png'))).toBe(true);
  });
});

describe('publicS3Url', () => {
  it('uses the S3 path style by default', () => {
    expect(publicS3Url('web-assets.youversion.com', 'versecut/x/1.jpg')).toBe(
      'https://s3.amazonaws.com/web-assets.youversion.com/versecut/x/1.jpg',
    );
  });
  it('prefers a CDN base when provided', () => {
    expect(publicS3Url('b', 'versecut/x/1.jpg', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/versecut/x/1.jpg',
    );
  });
});
