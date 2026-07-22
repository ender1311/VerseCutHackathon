import { withAuth } from '@workos-inc/authkit-nextjs';
import { isAllowedEmailDomain } from '@/lib/auth/domain';

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * Resolve the signed-in WorkOS user for server routes. In local dev with the
 * auth bypass on, returns a stand-in user so the library works without sign-in.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const { user } = await withAuth();
  if (user && isAllowedEmailDomain(user.email)) {
    return { id: user.id, email: user.email };
  }
  const bypass =
    process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTH === 'true';
  return bypass ? { id: 'dev-user', email: 'dev@local' } : null;
}
