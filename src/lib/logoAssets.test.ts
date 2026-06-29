import { describe, expect, it } from 'vitest';
import { resolveLogoFile } from './logoAssets';
import { BIBLE_APP_ASSETS } from './iconCatalog';

const iconOnly = BIBLE_APP_ASSETS['icon-only'];

describe('resolveLogoFile', () => {
  it('returns undefined for empty input', () => {
    expect(resolveLogoFile('icon-only', null)).toBeUndefined();
    expect(resolveLogoFile('icon-only', undefined)).toBeUndefined();
    expect(resolveLogoFile('icon-only', '')).toBeUndefined();
  });

  it('resolves an exact catalog key', () => {
    expect(resolveLogoFile('icon-only', 'af')).toBe(iconOnly['af']);
    expect(resolveLogoFile('icon-only', 'en')).toBe(iconOnly['en']);
  });

  it('maps YouVersion codes that differ from catalog keys (the bug fix)', () => {
    expect(resolveLogoFile('icon-only', 'ko')).toBe(iconOnly['kor']);
    expect(resolveLogoFile('icon-only', 'tl')).toBe(iconOnly['fl']);
    expect(resolveLogoFile('icon-only', 'ne')).toBe(iconOnly['ne-NP']);
    expect(resolveLogoFile('icon-only', 'pt')).toBe(iconOnly['pt-BR']);
    expect(resolveLogoFile('icon-only', 'sr')).toBe(iconOnly['srp-latn']);
    expect(resolveLogoFile('icon-only', 'sr_cyrillic')).toBe(iconOnly['srp-cyrl']);
    expect(resolveLogoFile('icon-only', 'ku_IQ')).toBe(iconOnly['ku']);
    expect(resolveLogoFile('icon-only', 'en_GB')).toBe(iconOnly['en']);
  });

  it('normalizes underscore region codes to hyphenated catalog keys', () => {
    expect(resolveLogoFile('icon-only', 'zh_CN')).toBe(iconOnly['zh-CN']);
    expect(resolveLogoFile('icon-only', 'zh_TW')).toBe(iconOnly['zh-TW']);
  });

  it('falls back to the base subtag when no exact key exists', () => {
    // 'es-LA' exists, but an unknown region like 'es-XX' should fall to 'es'
    expect(resolveLogoFile('icon-only', 'es-XX')).toBe(iconOnly['es']);
  });

  it('returns undefined when no localized asset exists at all', () => {
    expect(resolveLogoFile('icon-only', 'xh')).toBeUndefined();
    expect(resolveLogoFile('icon-only', 'am')).toBeUndefined();
  });
});
