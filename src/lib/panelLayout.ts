const SECTIONS_KEY = 'versecut:sections';

export type SectionKey = 'content' | 'background' | 'audio' | 'branding' | 'output';
export type SectionState = Record<SectionKey, boolean>;

export const DEFAULT_SECTIONS: SectionState = {
  content: true,
  background: true,
  audio: false,
  branding: false,
  output: true,
};

export function resolveSections(stored: Partial<SectionState> | null): SectionState {
  if (!stored) return { ...DEFAULT_SECTIONS };
  return {
    content: stored.content ?? DEFAULT_SECTIONS.content,
    background: stored.background ?? DEFAULT_SECTIONS.background,
    audio: stored.audio ?? DEFAULT_SECTIONS.audio,
    branding: stored.branding ?? DEFAULT_SECTIONS.branding,
    output: stored.output ?? DEFAULT_SECTIONS.output,
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
