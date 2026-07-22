import { describe, expect, it } from 'vitest';
import { geoUploadName } from '@/lib/export/geoUpload';
import { isValidExportKey } from '@/lib/server/uploadGuards';

describe('geoUploadName', () => {
  it('builds a guard-compatible jpg key for AWS and AIR', () => {
    const aws = geoUploadName('aws', '2026-07-22', 'South Africa', 0);
    expect(aws).toBe('versecut/2026-07-22/geo/south-africa_0.jpg');
    expect(isValidExportKey(aws)).toBe(true);

    const air = geoUploadName('air', '2026-07-22', 'France', 1);
    expect(air).toBe('versecut/2026-07-22/geo/france_1.jpg');
    expect(isValidExportKey(air)).toBe(true);
  });

  it('omits the extension for Braze (it derives type from MIME)', () => {
    expect(geoUploadName('braze', '2026-07-22', 'Spain', 2)).toBe('versecut/2026-07-22/geo/spain_2');
  });
});
