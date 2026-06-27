export interface Language {
  id: string;
  name: string;
  /** Optional grouping label for the picker (e.g. "Top picks"). */
  group?: string;
}

export interface BibleVersion {
  id: string;
  /** Short label, e.g. "NIV". */
  abbreviation: string;
  name: string;
  languageId: string;
}

export interface Book {
  id: string;
  name: string;
  /** Number of chapters, for stepper bounds. */
  chapters: number;
}

export interface Passage {
  /** Human reference, e.g. "John 3:16-17". */
  reference: string;
  /** Plain verse text, joined. */
  text: string;
  versionAbbreviation: string;
}

export interface PassageQuery {
  versionId: string;
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
}

/**
 * Swappable Bible data source. Implement this interface to plug in any
 * provider (API.Bible, a YouVersion proxy, a local cache, etc.).
 */
export interface BibleProvider {
  listLanguages(): Promise<Language[]>;
  listVersions(languageId: string): Promise<BibleVersion[]>;
  listBooks(versionId: string): Promise<Book[]>;
  fetchPassage(query: PassageQuery): Promise<Passage>;
}
