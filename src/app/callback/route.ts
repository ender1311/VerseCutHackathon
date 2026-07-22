import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS redirects here after sign-in; this completes the session then hands off
// to /callback/verify, which enforces the org email-domain allowlist.
export const GET = handleAuth({ returnPathname: '/callback/verify' });
