import { NextRequest, NextResponse } from 'next/server';
import { authkit, handleAuthkitProxy } from '@workos-inc/authkit-nextjs';
import { isPublic } from '@/lib/auth/route-access';
import { isAllowedEmailDomain } from '@/lib/auth/domain';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run authkit so withAuth() can resolve the session in server
  // components. The dev-only bypass (guarded by NODE_ENV, so it can never apply
  // in production) skips only the redirect gate, not session processing.
  const { session, headers } = await authkit(request);
  const bypass =
    process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTH === 'true';

  // A session whose email isn't on the org allowlist is treated as
  // unauthorized, so a stale/off-domain cookie can't reach any gated route.
  // /callback/verify (public) handles clearing it and messaging the user.
  const authorized = session.user && isAllowedEmailDomain(session.user.email);

  if (!bypass && !authorized && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // An authenticated-but-off-domain session must be cleared, not just bounced:
    // send it to /callback/verify (public), which signs it out with the
    // unauthorized message. A request with no session just goes to /login.
    const redirect = session.user ? '/callback/verify' : '/login';
    return handleAuthkitProxy(request, headers, { redirect });
  }

  return handleAuthkitProxy(request, headers);
}

export const config = {
  matcher: [
    // API routes ALWAYS run middleware (auth). Listed explicitly so the media-
    // extension exclusion below can't open an unauthenticated path to the
    // credentialed upstream proxies (e.g. /api/yvv/…/foo.mp4).
    '/api/(.*)',
    // Everything else except Next internals, public assets, the media stream,
    // and static media files (which are served without auth). `api/` is excluded
    // here because it's covered by the explicit matcher above.
    '/((?!_next/static|_next/image|favicon\\.ico|assets/|yvmedia/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$).*)',
  ],
};
