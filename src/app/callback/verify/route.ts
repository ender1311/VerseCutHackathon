import { NextResponse } from 'next/server';
import { withAuth, signOut } from '@workos-inc/authkit-nextjs';
import { isAllowedEmailDomain } from '@/lib/auth/domain';

// handleAuth() in /callback completes the WorkOS session and lands here. We
// enforce the org email-domain allowlist at login time: disallowed users are
// fully signed out (clearing the session) and sent back to /login with an error.
export async function GET(request: Request) {
  const { user } = await withAuth();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isAllowedEmailDomain(user.email)) {
    // Log only the domain — never the full address or user id — to keep PII out
    // of logs (CWE-532) while still surfacing which domains get rejected.
    console.warn('[auth-callback] rejected non-allowed domain', {
      domain: user.email.split('@')[1] ?? 'unknown',
    });
    await signOut({ returnTo: '/login?error=unauthorized' });
    return NextResponse.redirect(
      new URL('/login?error=unauthorized', request.url),
    );
  }

  return NextResponse.redirect(new URL('/', request.url));
}
