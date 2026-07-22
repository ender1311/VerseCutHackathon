import { describe, expect, it } from 'vitest';
import { BRAZE_HOURLY_LIMIT, effectiveExportLimit } from '@/lib/export/exportLimit';

describe('effectiveExportLimit', () => {
  it('passes the limit through for AWS and AIR (0 = all)', () => {
    expect(effectiveExportLimit('aws', 0)).toBe(0);
    expect(effectiveExportLimit('aws', 500)).toBe(500);
    expect(effectiveExportLimit('air', 0)).toBe(0);
    expect(effectiveExportLimit('air', 3000)).toBe(3000);
  });

  it('caps Braze at its hourly quota', () => {
    expect(effectiveExportLimit('braze', 0)).toBe(BRAZE_HOURLY_LIMIT); // "all" → cap
    expect(effectiveExportLimit('braze', 5000)).toBe(BRAZE_HOURLY_LIMIT);
    expect(effectiveExportLimit('braze', 100)).toBe(100);
    expect(effectiveExportLimit('braze', 25)).toBe(25); // already under
  });
});
