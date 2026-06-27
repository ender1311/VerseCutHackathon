import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import { APP_LANGUAGES, APP_LANGUAGE_BY_CODE } from './appLanguages';

/**
 * Verse text via YouVersion's internal reader API (bible.youversionapi.com),
 * reached through the same-origin /api/yvb proxy. Unlike the Platform API this
 * is not license-gated, so it serves the full Bible App language list
 * (alfred/bible_api/language_default_versions.py) — including Afrikaans.
 *
 * Versions are integer ids; references are USFM (e.g. JHN.3). The chapter
 * endpoint returns the whole chapter as HTML with per-verse `data-usfm` spans,
 * which we parse to extract the requested verse range.
 */
const BASE = '/api/yvb/3.1';

interface VersionData {
  abbreviation?: string;
  local_abbreviation?: string;
  title?: string;
  local_title?: string;
  books?: Array<{
    usfm: string;
    human?: string;
    text?: boolean;
    chapters?: unknown[];
  }>;
}

const versionCache = new Map<string, Promise<VersionData>>();

async function getVersion(versionId: string): Promise<VersionData> {
  let p = versionCache.get(versionId);
  if (!p) {
    p = fetch(`${BASE}/version.json?id=${versionId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`version.json ${r.status}`);
        return r.json();
      })
      .then((j) => (j?.response?.data ?? {}) as VersionData);
    versionCache.set(versionId, p);
  }
  return p;
}

export class YouVersionInternalProvider implements BibleProvider {
  async listLanguages(): Promise<Language[]> {
    return APP_LANGUAGES.map((l) => ({ id: l.code, name: l.name }));
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const lang = APP_LANGUAGE_BY_CODE[languageId];
    if (!lang) return [];
    const data = await getVersion(lang.defaultVersionId).catch(() => null);
    return [
      {
        id: lang.defaultVersionId,
        abbreviation: data?.local_abbreviation || data?.abbreviation || '',
        name: data?.local_title || data?.title || lang.name,
        languageId,
      },
    ];
  }

  async listBooks(versionId: string): Promise<Book[]> {
    const data = await getVersion(versionId);
    return (data.books ?? [])
      .filter((b) => b.text !== false)
      .map((b) => ({
        id: b.usfm,
        name: b.human || b.usfm,
        chapters: Array.isArray(b.chapters) ? Math.max(1, b.chapters.length) : 150,
      }));
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    const chapterRef = `${query.bookId}.${query.chapter}`;
    const res = await fetch(
      `${BASE}/chapter.json?id=${query.versionId}&reference=${chapterRef}&format=html`,
    );
    if (!res.ok) throw new Error(`chapter.json failed (${res.status})`);
    const data = (await res.json())?.response?.data ?? {};
    const text = extractVerses(
      data.content ?? '',
      query.bookId,
      query.chapter,
      query.fromVerse,
      query.toVerse,
    );

    const version = await getVersion(query.versionId).catch(() => null);
    const book = version?.books?.find((b) => b.usfm === query.bookId);
    const bookName = book?.human || query.bookId;
    const range =
      query.fromVerse === query.toVerse
        ? `${query.fromVerse}`
        : `${query.fromVerse}-${query.toVerse}`;

    return {
      reference: `${bookName} ${query.chapter}:${range}`,
      text: text || data.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
      versionAbbreviation: version?.local_abbreviation || version?.abbreviation || '',
    };
  }
}

/** Pull verses [from..to] out of a chapter's HTML using data-usfm spans. */
export function extractVerses(
  html: string,
  bookId: string,
  chapter: number,
  from: number,
  to: number,
): string {
  if (!html || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];
  for (let v = from; v <= to; v++) {
    const usfm = `${bookId}.${chapter}.${v}`;
    const nodes = doc.querySelectorAll(`[data-usfm="${usfm}"]`);
    let verseText = '';
    nodes.forEach((node) => {
      // Prefer the `.content` spans (verse words); they exclude the verse label.
      const content = node.querySelectorAll('.content');
      if (content.length) {
        content.forEach((c) => (verseText += c.textContent ?? ''));
      } else {
        verseText += node.textContent ?? '';
      }
    });
    verseText = verseText.replace(/\s+/g, ' ').trim();
    if (verseText) parts.push(verseText);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
