// App-wide feature toggles. When a feature is disabled, its controls are hidden
// from the studio input panel (declutter). Persisted to localStorage so the
// choice sticks across sessions.

export type SettingKey = 'voiceover' | 'music' | 'branding';
export type AppSettings = Record<SettingKey, boolean>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  voiceover: true,
  music: true,
  branding: true,
};

export const SETTING_META: { key: SettingKey; label: string; hint: string }[] = [
  { key: 'voiceover', label: 'Voiceover', hint: 'In-browser AI narration in the Audio section' },
  { key: 'music', label: 'Background music', hint: 'Music upload in the Audio section' },
  { key: 'branding', label: 'Branding', hint: 'Logo lockup options (classic template)' },
];

const KEY = 'versecut:settings';

export function resolveAppSettings(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return { ...DEFAULT_APP_SETTINGS };
  return {
    voiceover: stored.voiceover ?? DEFAULT_APP_SETTINGS.voiceover,
    music: stored.music ?? DEFAULT_APP_SETTINGS.music,
    branding: stored.branding ?? DEFAULT_APP_SETTINGS.branding,
  };
}

export function toggleSetting(state: AppSettings, key: SettingKey): AppSettings {
  return { ...state, [key]: !state[key] };
}

export function parseStoredAppSettings(raw: string | null): AppSettings {
  if (raw == null) return { ...DEFAULT_APP_SETTINGS };
  try {
    return resolveAppSettings(JSON.parse(raw) as Partial<AppSettings> | null);
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function readStoredAppSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_SETTINGS };
  try {
    return parseStoredAppSettings(window.localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function writeStoredAppSettings(state: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — ignore.
  }
}
