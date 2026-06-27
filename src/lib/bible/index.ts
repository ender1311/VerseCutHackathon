import { config } from '../../config';
import { ApiBibleProvider } from './apiBibleProvider';
import { MockBibleProvider } from './mockProvider';
import { YouVersionPlatformProvider } from './youVersionPlatformProvider';
import { YouVersionInternalProvider } from './internalProvider';
import { HybridBibleProvider } from './hybridProvider';
import type { BibleProvider } from './types';

let cached: BibleProvider | null = null;

/** Returns the configured Bible provider. Falls back to mock if unconfigured. */
export function getBibleProvider(): BibleProvider {
  if (cached) return cached;
  switch (config.bible.provider) {
    case 'youversion-hybrid':
      // Top picks + Bible App (internal) + full Platform catalog, grouped.
      cached = new HybridBibleProvider();
      break;
    case 'youversion-internal':
      // Internal reader API — full Bible App language list, no license gating.
      cached = new YouVersionInternalProvider();
      break;
    case 'youversion':
      cached = new YouVersionPlatformProvider();
      break;
    case 'api.bible':
      cached = config.bible.apiKey ? new ApiBibleProvider() : new MockBibleProvider();
      break;
    default:
      cached = new MockBibleProvider();
  }
  return cached;
}

export * from './types';
