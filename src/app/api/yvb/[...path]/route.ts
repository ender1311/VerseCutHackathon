import { makeProxyRoute } from '@/lib/server/proxy';

// Internal YouVersion reader API (bible.youversionapi.com) — serves verse text
// for any Bible App version by integer id + USFM reference. No license gating
// (unlike the Platform API), so it covers the full app language list.
export const GET = makeProxyRoute('https://bible.youversionapi.com', {
  referer: 'http://yvapi.youversionapi.com',
  'x-youversion-client': 'youversion',
  'x-youversion-app-platform': 'internal',
  'x-youversion-app-version': '1',
});
