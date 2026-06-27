// -----------------------------------------------------------------------------
// Verse Ad Studio — central, easy-to-edit configuration.
// Swap the Bible provider, drop in an API key, change defaults, or replace the
// logo asset here. Nothing else in the app should hard-code these values.
// -----------------------------------------------------------------------------

export const config = {
  /** Branding shown in the header + composited onto the ad. */
  brand: {
    name: 'Verse Ad Studio',
    tagline: 'YouVersion · Marketing',
    /**
     * Bottom-left logo composited onto every ad. Defaults to the official
     * English Bible App icon. Swap to any file in /assets/icons/** to rebrand,
     * or set logoByLanguage to auto-pick a localized icon (see below).
     */
    logoPath: '/assets/icons/bible-app/icon-only/en.svg',

    /**
     * When true, the ad's corner logo auto-selects the Bible App asset for the
     * chosen language + style (falling back to English, then logoPath).
     */
    logoByLanguage: true,
    logoBaseDir: '/assets/icons/bible-app',
    /** Default logo style; user can change it in the form. */
    defaultLogoStyle: 'icon-only' as 'icon-only' | 'logo-light' | 'logo-dark',
  },

  bible: {
    /**
     * Which provider to use:
     *  - 'mock'       — bundled sample data, zero setup (default).
     *  - 'youversion' — YouVersion Platform API (api.youversion.com), via proxy.
     *  - 'api.bible'  — scripture.api.bible.
     */
    provider: (process.env.NEXT_PUBLIC_BIBLE_PROVIDER ?? 'youversion-internal') as
      | 'mock'
      | 'youversion-internal'
      | 'youversion'
      | 'api.bible',

    /** API key (API.Bible, or YouVersion when calling directly w/o a proxy). */
    apiKey: process.env.NEXT_PUBLIC_BIBLE_API_KEY ?? '',

    apiBaseUrl: 'https://api.scripture.api.bible/v1',

    /** YouVersion Platform settings. Key is injected by a same-origin route handler. */
    youversion: {
      /** Relative base hits the /api proxy (keeps the app key server-side). */
      baseUrl: process.env.NEXT_PUBLIC_YV_BASE_URL ?? '/api/yvp',
      /** Only true when bypassing the proxy and calling the API directly. */
      sendKeyFromClient: process.env.NEXT_PUBLIC_YV_SEND_KEY === 'true',
    },

    /**
     * Default version id when the user doesn't choose one.
     * YouVersion: 111=NIV, 3034=BSB, 1=KJV. API.Bible uses its own ids.
     */
    defaultVersionId: process.env.NEXT_PUBLIC_BIBLE_DEFAULT_VERSION ?? '111',
  },

  /** Output presets. */
  output: {
    defaultFormat: 'video' as 'video' | 'image',
    defaultAspect: '9:16' as '9:16' | '16:9',
    videoDurationSec: 6,
    videoFps: 30,
  },
} as const;

export type AspectRatio = '9:16' | '1:1' | '16:9';
export type OutputFormat = 'video' | 'image';

/** Pixel dimensions for each aspect ratio (1080p-class). */
export const ASPECT_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};
