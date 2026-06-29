export const MIN_PANEL_WIDTH = 380;
export const MAX_PANEL_WIDTH = 720;
export const DEFAULT_PANEL_WIDTH = 460;

const WIDTH_KEY = 'versecut:panelWidth';
const SECTIONS_KEY = 'versecut:sections';

export function clampPanelWidth(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_PANEL_WIDTH;
  return Math.round(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, px)));
}

export function parseStoredWidth(raw: string | null): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return clampPanelWidth(n);
}

export function readStoredWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredWidth(window.localStorage.getItem(WIDTH_KEY));
  } catch {
    return null;
  }
}

export function writeStoredWidth(px: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WIDTH_KEY, String(clampPanelWidth(px)));
  } catch {
    // localStorage unavailable (private mode / quota) — ignore.
  }
}

export type SectionKey = 'content' | 'background' | 'audio' | 'branding';
export type SectionState = Record<SectionKey, boolean>;

export const DEFAULT_SECTIONS: SectionState = {
  content: true,
  background: true,
  audio: false,
  branding: false,
};

export function resolveSections(stored: Partial<SectionState> | null): SectionState {
  if (!stored) return { ...DEFAULT_SECTIONS };
  return {
    content: stored.content ?? DEFAULT_SECTIONS.content,
    background: stored.background ?? DEFAULT_SECTIONS.background,
    audio: stored.audio ?? DEFAULT_SECTIONS.audio,
    branding: stored.branding ?? DEFAULT_SECTIONS.branding,
  };
}

export function toggleSection(state: SectionState, key: SectionKey): SectionState {
  return { ...state, [key]: !state[key] };
}

export function parseStoredSections(raw: string | null): SectionState {
  if (raw == null) return { ...DEFAULT_SECTIONS };
  try {
    const obj = JSON.parse(raw) as Partial<SectionState> | null;
    return resolveSections(obj);
  } catch {
    return { ...DEFAULT_SECTIONS };
  }
}

export function readStoredSections(): SectionState {
  if (typeof window === 'undefined') return { ...DEFAULT_SECTIONS };
  try {
    return parseStoredSections(window.localStorage.getItem(SECTIONS_KEY));
  } catch {
    return { ...DEFAULT_SECTIONS };
  }
}

export function writeStoredSections(state: SectionState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — ignore.
  }
}
