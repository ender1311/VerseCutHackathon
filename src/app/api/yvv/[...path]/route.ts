import { makeProxyRoute } from '@/lib/server/proxy';

// Videos 5.0 — video_id → playback sources.
export const GET = makeProxyRoute('https://videos.youversionapi.com', {
  'x-youversion-client': 'youversion',
  'x-youversion-app-platform': 'ios',
  'x-youversion-app-version': '122',
  'accept-language': 'en',
});
