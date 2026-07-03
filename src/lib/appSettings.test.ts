import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings,
  toggleSetting,
  parseStoredAppSettings,
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
