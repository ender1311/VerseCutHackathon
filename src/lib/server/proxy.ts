// Shared upstream proxy for the YouVersion APIs. Runs server-side only so
// secrets (the Platform app key) and required client headers never reach the
// browser. Node's fetch (undici) advertises gzip and decompresses automatically,
// which Stories 4.0 requires.

/**
 * Validate the catch-all path segments before forwarding: reject path traversal
 * and, when an allowlist is given, anything whose first segment isn't permitted.
 * This keeps the proxy (which attaches server-side credentials) scoped to the
 * intended API surface rather than an arbitrary path on the upstream host.
 */
export function isAllowedPath(
  pathSegments: string[],
  allowedPrefixes?: string[],
): boolean {
  if (pathSegments.length === 0) return false;
  for (const seg of pathSegments) {
    if (seg === '' || seg === '.' || seg === '..' || seg.includes('/') || seg.includes('\\')) {
      return false;
    }
  }
  if (allowedPrefixes && !allowedPrefixes.includes(pathSegments[0])) return false;
  return true;
}

export async function proxyUpstream(
  req: Request,
  base: string,
  pathSegments: string[],
  injectHeaders: Record<string, string>,
  allowedPrefixes?: string[],
): Promise<Response> {
  if (!isAllowedPath(pathSegments, allowedPrefixes)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const search = new URL(req.url).search;
  const upstream = `${base}/${pathSegments.join('/')}${search}`;

  const res = await fetch(upstream, {
    method: 'GET',
    headers: { accept: 'application/json', ...injectHeaders },
  });

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export function makeProxyRoute(
  base: string,
  headers: Record<string, string>,
  allowedPrefixes?: string[],
) {
  return async function GET(req: Request, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxyUpstream(req, base, path ?? [], headers, allowedPrefixes);
  };
}
