import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, APP_LANGUAGE_BY_CODE } from './appLanguages';

describe('APP_LANGUAGES', () => {
  it('includes Afrikaans with its default version', () => {
    const af = APP_LANGUAGE_BY_CODE['af'];
    expect(af).toBeTruthy();
    expect(af.name).toBe('Afrikaans');
    expect(af.defaultVersionId).toBe('6');
  });

  it('includes English and a broad set of app languages', () => {
    expect(APP_LANGUAGE_BY_CODE['en']?.defaultVersionId).toBe('111');
    expect(APP_LANGUAGES.length).toBeGreaterThanOrEqual(60);
  });

  it('every language has a numeric default version id', () => {
    for (const l of APP_LANGUAGES) {
      expect(l.defaultVersionId).toMatch(/^\d+$/);
      expect(l.name.length).toBeGreaterThan(0);
    }
  });
});
