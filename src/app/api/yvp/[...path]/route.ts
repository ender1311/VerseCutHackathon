import { makeProxyRoute } from '@/lib/server/proxy';

// YouVersion Platform API. The app key stays server-side (never in the bundle).
const APP_KEY = process.env.YV_PLATFORM_API_KEY || process.env.YVP_APP_KEY || '';

export const GET = makeProxyRoute('https://api.youversion.com', {
  'x-yvp-app-key': APP_KEY,
});
