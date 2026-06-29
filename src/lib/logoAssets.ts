import { BIBLE_APP_ASSETS, type LogoStyle } from './iconCatalog';

// YouVersion language-picker codes (see appLanguages.ts) that don't match the
// generated catalog keys in iconCatalog.ts. The art exists — it's just keyed
// under a different code — so without these aliases the lookup misses and the
// logo silently falls back to English. Maps picker code -> catalog key.
const LOGO_CODE_ALIASES: Record<string, string> = {
  ko: 'kor', // Korean
  tl: 'fl', // Tagalog / Filipino
  ne: 'ne-NP', // Nepali
  pt: 'pt-BR', // generic Portuguese -> Brazilian
  sr: 'srp-latn', // generic Serbian -> Latin
  sr_cyrillic: 'srp-cyrl', // Serbian (Cyrillic)
  ku_IQ: 'ku', // Kurdish (Sorani)
  en_GB: 'en', // English (UK)
  zh_CN: 'zh-CN', // Chinese (Simplified)
  zh_TW: 'zh-TW', // Chinese (Traditional)
  zh_HK: 'zh-HK', // Chinese (Hong Kong)
};

/**
 * Resolve the Bible App logo filename for a YouVersion language code within a
 * style, or undefined if no localized asset exists. Tries: exact catalog key,
 * explicit alias, underscore→hyphen normalization, then the base subtag.
 */
export function resolveLogoFile(
  style: LogoStyle,
  code: string | null | undefined,
): string | undefined {
  if (!code) return undefined;
  const cat = BIBLE_APP_ASSETS[style] ?? BIBLE_APP_ASSETS['icon-only'];
  const normalized = code.replace(/_/g, '-');
  const alias = LOGO_CODE_ALIASES[code] ?? LOGO_CODE_ALIASES[normalized];
  return (
    cat[code] ||
    (alias ? cat[alias] : undefined) ||
    cat[normalized] ||
    cat[normalized.split('-')[0]] ||
    undefined
  );
}
