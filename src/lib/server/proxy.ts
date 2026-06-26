// Shared upstream proxy for the YouVersion APIs. Runs server-side only so
// secrets (the Platform app key) and required client headers never reach the
// browser. Node's fetch (undici) advertises gzip and decompresses automatically,
// which Stories 4.0 requires.

export async function proxyUpstream(
  req: Request,
  base: string,
  pathSegments: string[],
  injectHeaders: Record<string, string>,
): Promise<Response> {
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

export function makeProxyRoute(base: string, headers: Record<string, string>) {
  return async function GET(req: Request, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxyUpstream(req, base, path ?? [], headers);
  };
}
