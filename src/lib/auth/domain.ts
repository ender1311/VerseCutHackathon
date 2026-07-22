/**
 * Email domains permitted to sign in. WorkOS authenticates the user; this
 * allowlist restricts access to the YouVersion org regardless of which SSO
 * connection (Google, etc.) WorkOS used.
 */
export const ALLOWED_EMAIL_DOMAINS = [
  '@youversion.com',
  '@uversion.com',
  '@life.church',
] as const;

/**
 * True when `email` belongs to an allowed org domain. The leading `@` anchors
 * the match so lookalikes (e.g. `evil-youversion.com`, `sub.youversion.com`)
 * are rejected.
 */
export function isAllowedEmailDomain(email?: string | null): boolean {
  const lower = email?.trim().toLowerCase();
  return Boolean(lower && ALLOWED_EMAIL_DOMAINS.some((d) => lower.endsWith(d)));
}
