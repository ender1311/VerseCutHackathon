import type { LogoStyle } from '../iconCatalog';
import { resolveLogoFile } from '../logoAssets';

export interface BulkLogo {
  languageId: string;
  logoStyle: LogoStyle;
}

/**
 * Covered languages (those with localized art) render in the chosen style.
 * Everything else uses the English icon-only mark — the plain app icon with no
 * "Bible App" wordmark — never a lockup.
 */
export function resolveBulkLogo(code: string, chosenStyle: LogoStyle): BulkLogo {
  if (resolveLogoFile(chosenStyle, code)) {
    return { languageId: code, logoStyle: chosenStyle };
  }
  return { languageId: 'en', logoStyle: 'icon-only' };
}
