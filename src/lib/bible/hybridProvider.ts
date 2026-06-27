import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import { YouVersionInternalProvider } from './internalProvider';
import { YouVersionPlatformProvider } from './youVersionPlatformProvider';
import { APP_LANGUAGE_BY_CODE } from './appLanguages';

const TOP_PICKS = ['en', 'es', 'pt', 'fr'];

/**
 * Combines two sources into one grouped picker:
 *  - Top picks + the Bible App language list → internal reader API (`i:` ids)
 *  - The full licensed Platform catalog → Platform API (`p:` ids)
 *
 * Language and version ids are prefixed with their source so every downstream
 * call (versions → books → passage) routes back to the right provider.
 */
export class HybridBibleProvider implements BibleProvider {
  private internal = new YouVersionInternalProvider();
  private platform = new YouVersionPlatformProvider();

  async listLanguages(): Promise<Language[]> {
    const out: Language[] = [];

    for (const code of TOP_PICKS) {
      const l = APP_LANGUAGE_BY_CODE[code];
      if (l) out.push({ id: `i:${code}`, name: l.name, group: 'Top picks' });
    }

    const internal = await this.internal.listLanguages();
    for (const l of internal) {
      out.push({ id: `i:${l.id}`, name: l.name, group: 'Bible App languages' });
    }

    try {
      const platform = await this.platform.listLanguages();
      const group = `All languages (${platform.length})`;
      for (const l of platform) out.push({ id: `p:${l.id}`, name: l.name, group });
    } catch {
      /* platform catalog optional — keep the internal sets if it fails */
    }

    return out;
  }

  private route(prefixed: string): { provider: BibleProvider; id: string } {
    const i = prefixed.indexOf(':');
    const src = i >= 0 ? prefixed.slice(0, i) : 'i';
    const id = i >= 0 ? prefixed.slice(i + 1) : prefixed;
    return { provider: src === 'p' ? this.platform : this.internal, id };
  }

  private srcOf(prefixed: string): 'i' | 'p' {
    return prefixed.startsWith('p:') ? 'p' : 'i';
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const src = this.srcOf(languageId);
    const { provider, id } = this.route(languageId);
    const versions = await provider.listVersions(id);
    return versions.map((v) => ({ ...v, id: `${src}:${v.id}` }));
  }

  async listBooks(versionId: string): Promise<Book[]> {
    const { provider, id } = this.route(versionId);
    return provider.listBooks(id);
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    const { provider, id } = this.route(query.versionId);
    return provider.fetchPassage({ ...query, versionId: id });
  }
}
