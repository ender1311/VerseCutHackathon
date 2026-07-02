import { describe, expect, it } from 'vitest';
import { deriveSource, orientationOf, parseYouVersionName } from './assetTaxonomy';

describe('deriveSource', () => {
  it('classifies by name prefix', () => {
    expect(deriveSource('YouVersion · JHN.3.16 · en · 77039')).toBe('youversion');
    expect(deriveSource('Unsplash · simon · 9Ct73y')).toBe('unsplash');
    expect(deriveSource('Pexels · Ruvim M · 1526909')).toBe('pexels');
    expect(deriveSource('some upload.png')).toBe('other');
  });
});

describe('orientationOf', () => {
  it('is portrait when taller than wide', () => {
    expect(orientationOf(1280, 2276)).toBe('portrait');
  });
  it('is landscape when wider than or equal', () => {
    expect(orientationOf(1920, 1080)).toBe('landscape');
    expect(orientationOf(1000, 1000)).toBe('landscape');
  });
});

describe('parseYouVersionName', () => {
  it('extracts usfm/language/id', () => {
    expect(parseYouVersionName('YouVersion · JHN.3.16 · en · 77039')).toEqual({
      usfm: 'JHN.3.16',
      language: 'en',
      id: '77039',
    });
  });
  it('returns null for non-YouVersion names', () => {
    expect(parseYouVersionName('Unsplash · simon · 9Ct73y')).toBeNull();
    expect(parseYouVersionName('YouVersion · too · few')).toBeNull();
  });
});
