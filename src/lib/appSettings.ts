// App-wide feature toggles. When a feature is disabled, its controls are hidden
// from the studio input panel (declutter). Persisted to localStorage so the
// choice sticks across sessions.

export type SettingKey = 'voiceover' | 'music' | 'branding';

/** Which studio layout ("direction") to render on desktop (≥lg). */
export type UiMode = 'guided' | 'everlight' | 'everdark' | 'templates';

export const UI_MODES: readonly UiMode[] = ['guided', 'everlight', 'everdark', 'templates'];

export const DEFAULT_UI_MODE: UiMode = 'guided';

export const UI_MODE_META: { id: UiMode; name: string; tagline: string }[] = [
  { id: 'guided', name: 'Guided Path', tagline: 'One decision at a time, along a numbered spine' },
  { id: 'everlight', name: 'Everlight', tagline: 'Calm editorial — big preview, quiet inspector' },
  { id: 'everdark', name: 'Everdark Studio', tagline: 'Dark pro editor with a tool rail + stage' },
  { id: 'templates', name: 'Templates-first', tagline: 'Start from a ready-made look, then tweak' },
];

/** A saved default Bible reference to prefill new sessions. */
export interface VerseDefault {
  book: string; // USFM book id, e.g. "JHN"
  bookName: string; // human label for display, e.g. "John"
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

export interface AppSettings {
  voiceover: boolean;
  music: boolean;
  branding: boolean;
  /** null = use the built-in default (John 3:16-17). */
  verseDefault: VerseDefault | null;
  /** Desktop layout direction. */
  uiMode: UiMode;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  voiceover: true,
  music: true,
  branding: true,
  verseDefault: null,
  uiMode: DEFAULT_UI_MODE,
};

/** Coerce a stored value to a known UiMode, defaulting when unrecognized. */
export function sanitizeUiMode(v: unknown): UiMode {
  return typeof v === 'string' && (UI_MODES as readonly string[]).includes(v)
    ? (v as UiMode)
    : DEFAULT_UI_MODE;
}

export const SETTING_META: { key: SettingKey; label: string; hint: string }[] = [
  { key: 'voiceover', label: 'Voiceover', hint: 'In-browser AI narration in the Audio section' },
  { key: 'music', label: 'Background music', hint: 'Music upload in the Audio section' },
  { key: 'branding', label: 'Branding', hint: 'Logo lockup options (classic template)' },
];

const KEY = 'versecut:settings';

const MAX_VERSE = 176; // Psalm 119
const clampInt = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(Math.round(n), lo), hi) : fallback;

/** Validate/clamp a stored verse default so a corrupt localStorage value can't
 * seed an invalid or incoherent range (e.g. toVerse < fromVerse, 0, NaN). */
export function sanitizeVerseDefault(vd: Partial<VerseDefault> | null | undefined): VerseDefault | null {
  if (!vd || typeof vd.book !== 'string' || !vd.book) return null;
  const chapter = clampInt(vd.chapter, 1, 150, 1);
  const fromVerse = clampInt(vd.fromVerse, 1, MAX_VERSE, 1);
  const toVerse = clampInt(vd.toVerse, fromVerse, MAX_VERSE, fromVerse);
  return {
    book: vd.book,
    bookName: typeof vd.bookName === 'string' && vd.bookName ? vd.bookName : vd.book,
    chapter,
    fromVerse,
    toVerse,
  };
}

export function resolveAppSettings(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return { ...DEFAULT_APP_SETTINGS };
  return {
    voiceover: stored.voiceover ?? DEFAULT_APP_SETTINGS.voiceover,
    music: stored.music ?? DEFAULT_APP_SETTINGS.music,
    branding: stored.branding ?? DEFAULT_APP_SETTINGS.branding,
    verseDefault: sanitizeVerseDefault(stored.verseDefault),
    uiMode: sanitizeUiMode(stored.uiMode),
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
