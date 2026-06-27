// Script detection + on-demand font loading so verse text renders correctly in
// any language on the canvas (the Latin display font Fraunces has no CJK/Arabic/
// Indic/etc. glyphs). Picks a Noto serif family per script and loads it from
// Google Fonts; also reports RTL for Arabic/Hebrew.

export type Script =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'thai'
  | 'han'
  | 'japanese'
  | 'korean';

const RANGES: { script: Script; re: RegExp }[] = [
  { script: 'arabic', re: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/ },
  { script: 'hebrew', re: /[֐-׿יִ-ﭏ]/ },
  { script: 'devanagari', re: /[ऀ-ॿ]/ },
  { script: 'thai', re: /[฀-๿]/ },
  { script: 'japanese', re: /[぀-ヿ]/ }, // kana ⇒ Japanese
  { script: 'korean', re: /[가-힯ᄀ-ᇿ]/ },
  { script: 'han', re: /[㐀-䶿一-鿿豈-﫿]/ },
  { script: 'cyrillic', re: /[Ѐ-ӿ]/ },
  { script: 'greek', re: /[Ͱ-Ͽ]/ },
];

/** Detect the dominant non-Latin script of a string (Latin if none found). */
export function detectScript(text: string): Script {
  // Count matches per script; kana presence forces Japanese over bare Han.
  const counts: Partial<Record<Script, number>> = {};
  for (const ch of text) {
    for (const { script, re } of RANGES) {
      if (re.test(ch)) {
        counts[script] = (counts[script] ?? 0) + 1;
        break;
      }
    }
  }
  if (counts.japanese) return 'japanese';
  let best: Script = 'latin';
  let max = 0;
  for (const { script } of RANGES) {
    const n = counts[script] ?? 0;
    if (n > max) {
      max = n;
      best = script;
    }
  }
  return best;
}

interface FontSpec {
  /** ctx.font family name. */
  family: string;
  /** Google Fonts `family=` query value, or null when bundled (Fraunces). */
  googleFamily: string | null;
  rtl: boolean;
}

function spec(script: Script, languageId?: string): FontSpec {
  switch (script) {
    case 'arabic':
      return { family: 'Noto Naskh Arabic', googleFamily: 'Noto+Naskh+Arabic:wght@400..700', rtl: true };
    case 'hebrew':
      return { family: 'Noto Serif Hebrew', googleFamily: 'Noto+Serif+Hebrew:wght@400..700', rtl: true };
    case 'devanagari':
      return { family: 'Noto Serif Devanagari', googleFamily: 'Noto+Serif+Devanagari:wght@400..700', rtl: false };
    case 'thai':
      return { family: 'Noto Serif Thai', googleFamily: 'Noto+Serif+Thai:wght@400..700', rtl: false };
    case 'japanese':
      return { family: 'Noto Serif JP', googleFamily: 'Noto+Serif+JP:wght@400..700', rtl: false };
    case 'korean':
      return { family: 'Noto Serif KR', googleFamily: 'Noto+Serif+KR:wght@400..700', rtl: false };
    case 'han': {
      const tw =
        languageId === 'zh-TW' || languageId === 'zh-HK' || languageId === 'zh_TW';
      return tw
        ? { family: 'Noto Serif TC', googleFamily: 'Noto+Serif+TC:wght@400..700', rtl: false }
        : { family: 'Noto Serif SC', googleFamily: 'Noto+Serif+SC:wght@400..700', rtl: false };
    }
    case 'cyrillic':
    case 'greek':
      // Fraunces lacks these; Noto Serif covers Latin/Cyrillic/Greek.
      return { family: 'Noto Serif', googleFamily: 'Noto+Serif:ital,wght@0,400..700;1,400..600', rtl: false };
    default:
      return { family: 'Fraunces', googleFamily: null, rtl: false };
  }
}

const loaded = new Map<string, Promise<void>>();

function injectGoogleFont(googleFamily: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existing = loaded.get(googleFamily);
  if (existing) return existing;
  const p = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  loaded.set(googleFamily, p);
  return p;
}

export interface VerseFont {
  family: string;
  rtl: boolean;
  script: Script;
}

/**
 * Resolve + load the verse font for a string. Ensures the glyphs needed by
 * `text` are fetched before returning so the canvas can draw them.
 */
export async function loadVerseFont(text: string, languageId?: string): Promise<VerseFont> {
  const script = detectScript(text);
  const s = spec(script, languageId);
  if (s.googleFamily) await injectGoogleFont(s.googleFamily);
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load(`600 80px '${s.family}'`, text),
        document.fonts.load(`700 32px '${s.family}'`, text),
      ]);
    } catch {
      /* fall back to system serif */
    }
  }
  return { family: s.family, rtl: s.rtl, script };
}
