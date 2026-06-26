import { makeProxyRoute } from '@/lib/server/proxy';

// Stories 4.0 — Guided Scripture lessons by date.
export const GET = makeProxyRoute('https://stories.youversionapi.com', {
  'x-country-code': 'us',
  'x-youversion-client': 'youversion',
  'x-youversion-app-platform': 'ios',
  'x-youversion-app-version': '122',
  'user-agent': 'Bible/7.4.1 (iPhone; iOS 14.4; en_US)',
});
