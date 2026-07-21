import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_UI_MODE,
  resolveAppSettings,
  sanitizeUiMode,
  toggleSetting,
  parseStoredAppSettings,
  sanitizeVerseDefault,
} from './appSettings';

describe('resolveAppSettings', () => {
  it('returns defaults for null', () => {
    expect(resolveAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
  });
  it('merges a partial over defaults', () => {
    expect(resolveAppSettings({ voiceover: false })).toEqual({
      ...DEFAULT_APP_SETTINGS,
      voiceover: false,
    });
  });
});

describe('toggleSetting', () => {
  it('flips one key without mutating input', () => {
    const start = { ...DEFAULT_APP_SETTINGS };
    const next = toggleSetting(start, 'music');
    expect(next.music).toBe(!DEFAULT_APP_SETTINGS.music);
    expect(next.voiceover).toBe(DEFAULT_APP_SETTINGS.voiceover);
    expect(start.music).toBe(DEFAULT_APP_SETTINGS.music);
  });
});

describe('sanitizeVerseDefault', () => {
  it('returns null when there is no book', () => {
    expect(sanitizeVerseDefault(null)).toBeNull();
    expect(sanitizeVerseDefault({ chapter: 3 })).toBeNull();
  });
  it('passes a valid default through', () => {
    expect(
      sanitizeVerseDefault({ book: 'JHN', bookName: 'John', chapter: 3, fromVerse: 16, toVerse: 17 }),
    ).toEqual({ book: 'JHN', bookName: 'John', chapter: 3, fromVerse: 16, toVerse: 17 });
  });
  it('clamps corrupt/incoherent values (regression)', () => {
    const r = sanitizeVerseDefault({ book: 'PSA', chapter: 0, fromVerse: 10, toVerse: 2 } as never);
    expect(r).toEqual({ book: 'PSA', bookName: 'PSA', chapter: 1, fromVerse: 10, toVerse: 10 });
  });
  it('falls back for NaN / non-numeric ranges', () => {
    const r = sanitizeVerseDefault({ book: 'GEN', chapter: NaN, fromVerse: -5, toVerse: 999 } as never);
    expect(r).toEqual({ book: 'GEN', bookName: 'GEN', chapter: 1, fromVerse: 1, toVerse: 176 });
  });
});

describe('sanitizeUiMode', () => {
  it('defaults to guided', () => {
    expect(DEFAULT_UI_MODE).toBe('guided');
    expect(sanitizeUiMode(undefined)).toBe('guided');
    expect(sanitizeUiMode(null)).toBe('guided');
    expect(sanitizeUiMode('nonsense')).toBe('guided');
    expect(sanitizeUiMode(3)).toBe('guided');
  });
  it('passes known modes through', () => {
    expect(sanitizeUiMode('everlight')).toBe('everlight');
    expect(sanitizeUiMode('everdark')).toBe('everdark');
    expect(sanitizeUiMode('templates')).toBe('templates');
    expect(sanitizeUiMode('guided')).toBe('guided');
  });
  it('resolveAppSettings coerces an invalid stored uiMode to the default', () => {
    expect(resolveAppSettings({ uiMode: 'bogus' as never }).uiMode).toBe('guided');
    expect(resolveAppSettings({ uiMode: 'everdark' }).uiMode).toBe('everdark');
  });
});

describe('parseStoredAppSettings', () => {
  it('returns defaults for null / invalid JSON', () => {
    expect(parseStoredAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(parseStoredAppSettings('{bad')).toEqual(DEFAULT_APP_SETTINGS);
  });
  it('merges valid partial JSON', () => {
    expect(parseStoredAppSettings('{"branding":false}')).toEqual({
      ...DEFAULT_APP_SETTINGS,
      branding: false,
    });
  });
});
