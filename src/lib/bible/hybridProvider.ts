import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import { YouVersionInternalProvider } from './internalProvider';

const TOP_PICKS = ['eng', 'spa', 'por', 'fra'];

/**
 * One grouped picker over the internal reader API (full manifest). "Top picks"
 * are surfaced first, then every catalog language. Ids stay `i:`-prefixed so
 * downstream calls route back to the internal provider.
 */
export class HybridBibleProvider implements BibleProvider {
  private internal = new YouVersionInternalProvider();

  async listLanguages(): Promise<Language[]> {
    const all = await this.internal.listLanguages();
    const byTag = new Map(all.map((l) => [l.id, l]));
    const out: Language[] = [];

    for (const tag of TOP_PICKS) {
      const l = byTag.get(tag);
      if (l) out.push({ ...l, id: `i:${l.id}`, group: 'Top picks' });
    }
    for (const l of all) {
      out.push({ ...l, id: `i:${l.id}`, group: 'All languages' });
    }
    return out;
  }

  private route(prefixed: string): string {
    const i = prefixed.indexOf(':');
    return i >= 0 ? prefixed.slice(i + 1) : prefixed;
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const id = this.route(languageId);
    const versions = await this.internal.listVersions(id);
    return versions.map((v) => ({ ...v, id: `i:${v.id}` }));
  }

  async listBooks(versionId: string): Promise<Book[]> {
    return this.internal.listBooks(this.route(versionId));
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    return this.internal.fetchPassage({ ...query, versionId: this.route(query.versionId) });
  }
}
