# Product-Marketing Video Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist product-marketing videos in the production DB + Blob (built locally, published to prod), and show them as a library on the `/product` tab, with the builder as a secondary section.

**Architecture:** New `ProductVideo` Prisma model; a local-dev `POST /api/pm/publish` route that reads a rendered file, uploads to Blob, and inserts a row; `GET/POST /api/product-videos` for prod reads/writes; a `ProductLibrary` grid reusing a shared `LazyVideo`; `/product` page reordered library-first.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Prisma 6 + Neon · Vercel Blob · Vitest.

## Global Constraints

- No `any`; new pure logic in `src/lib/` gets a `*.test.ts`; relative imports inside `src/`.
- API routes return `{ data }` or `{ error }` with correct status codes.
- `fileUrl` persisted only if `isManagedBlobUrl()` (from `src/lib/server/blob.ts`).
- PM publish routes are local-dev only (`pmEnabled()` from `src/lib/server/pm.ts`), like existing `/api/pm/*`.
- `npm run check` must pass before pushing.
- The production `prisma db push` is GATED — do NOT run it without explicit user confirmation (Task 7).
- PM videos use the new `ProductVideo` table only — never `SharedAsset`.

---

### Task 1: `ProductVideo` model + pure filename parser + tests

**Files:**
- Modify: `prisma/schema.prisma` (append model)
- Create: `src/lib/productVideo.ts`
- Test: `src/lib/productVideo.test.ts`

**Interfaces:**
- Produces: `parseOutputName(name: string): { length: string; lang: string; orientation: string } | null`; `type ProductVideoInput = { feature: string; title: string; length: string; lang: string; orientation: string; fileUrl: string; mime?: string | null; sizeBytes?: number | null }`.

- [ ] **Step 1: Append the Prisma model** to `prisma/schema.prisma`:

```prisma
/// A published product-marketing video (built locally, published to prod).
model ProductVideo {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  ownerId     String
  ownerEmail  String
  feature     String
  title       String
  length      String // 'short' | 'long'
  lang        String
  orientation String // 'portrait' | 'landscape'
  fileUrl     String
  mime        String?
  sizeBytes   Int?

  @@index([feature])
  @@index([createdAt])
}
```

- [ ] **Step 2: Regenerate the Prisma client (local, safe)**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". (Do NOT run `db push` here — gated to Task 7.)

- [ ] **Step 3: Write the failing test** — create `src/lib/productVideo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseOutputName } from './productVideo';

describe('parseOutputName', () => {
  it('parses a short en portrait name', () => {
    expect(parseOutputName('reading-plans-short-en-portrait.mp4')).toEqual({
      length: 'short', lang: 'en', orientation: 'portrait',
    });
  });
  it('parses a long es landscape name', () => {
    expect(parseOutputName('reading-plans-long-es-landscape.mp4')).toEqual({
      length: 'long', lang: 'es', orientation: 'landscape',
    });
  });
  it('returns null for non-matching names', () => {
    expect(parseOutputName('reading-plans.mp4')).toBeNull();
    expect(parseOutputName('foo-medium-en-portrait.mp4')).toBeNull();
    expect(parseOutputName('not-a-video.txt')).toBeNull();
  });
});
```

- [ ] **Step 4: Run it (expect fail)** — `npm run test -- productVideo` → FAIL (module missing).

- [ ] **Step 5: Implement** — create `src/lib/productVideo.ts`:

```ts
export type ProductVideoInput = {
  feature: string;
  title: string;
  length: string;
  lang: string;
  orientation: string;
  fileUrl: string;
  mime?: string | null;
  sizeBytes?: number | null;
};

// Matches "<feature>-<length>-<lang>-<orientation>.mp4" (same shape as pm.ts listOutputs).
export function parseOutputName(
  name: string,
): { length: string; lang: string; orientation: string } | null {
  const m = name.replace(/\.mp4$/, '').match(/-(short|long)-([a-z]{2})-(portrait|landscape)$/);
  if (!m) return null;
  return { length: m[1], lang: m[2], orientation: m[3] };
}
```

- [ ] **Step 6: Run it (expect pass)** — `npm run test -- productVideo` → PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/productVideo.ts src/lib/productVideo.test.ts
git commit -m "Add ProductVideo model + output-name parser with tests"
```

---

### Task 2: Extract shared `LazyVideo` component

**Files:**
- Create: `src/components/LazyVideo.tsx`
- Modify: `src/components/ImageLibrary.tsx` (remove its local `LazyVideo`, import the shared one)

**Interfaces:**
- Produces: `LazyVideo({ src }: { src: string })` — IntersectionObserver-lazy `<video muted playsInline preload="metadata">` with a pulsing placeholder until near-viewport.

- [ ] **Step 1: Create `src/components/LazyVideo.tsx`** with the exact component currently defined inside `ImageLibrary.tsx` (move it verbatim; it uses `useEffect`, `useRef`, `useState`, `rootMargin: '400px 0px'`, placeholder `animate-pulse-soft bg-line-soft`). Add `'use client';` at the top.

- [ ] **Step 2: Update `ImageLibrary.tsx`** — delete the local `function LazyVideo(...)` definition and add `import { LazyVideo } from './LazyVideo';`. Leave all usage unchanged.

- [ ] **Step 3: Verify** — `npm run typecheck && npm run test -- ImageLibrary` (no test may exist; then just `npm run check`). Expected: PASS, no behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/components/LazyVideo.tsx src/components/ImageLibrary.tsx
git commit -m "Extract shared LazyVideo component"
```

---

### Task 3: API routes — `product-videos` (list/register) + `pm/publish`

**Files:**
- Create: `src/app/api/product-videos/route.ts`
- Create: `src/app/api/pm/publish/route.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `currentUser` (`@/lib/server/currentUser`), `isManagedBlobUrl` (`@/lib/server/blob`), `pmEnabled`/`resolveOutputPath` (`@/lib/server/pm`), `parseOutputName`/`type ProductVideoInput` (`@/lib/productVideo`), `put` (`@vercel/blob`), `readFileSync` (`node:fs`).

- [ ] **Step 1: Create `src/app/api/product-videos/route.ts`** (mirror the shape of `src/app/api/uploads/route.ts`):

```ts
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { isManagedBlobUrl } from '@/lib/server/blob';

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await prisma.productVideo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return Response.json({ data });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json();
  const required = ['feature', 'title', 'length', 'lang', 'orientation', 'fileUrl'] as const;
  for (const k of required) {
    if (!b?.[k]) return Response.json({ error: `${k} required` }, { status: 400 });
  }
  if (!isManagedBlobUrl(b.fileUrl)) {
    return Response.json({ error: 'fileUrl must be a managed Blob URL' }, { status: 400 });
  }
  const row = await prisma.productVideo.create({
    data: {
      ownerId: user.id,
      ownerEmail: user.email,
      feature: String(b.feature),
      title: String(b.title),
      length: String(b.length),
      lang: String(b.lang),
      orientation: String(b.orientation),
      fileUrl: String(b.fileUrl),
      mime: b.mime ?? 'video/mp4',
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : null,
    },
  });
  return Response.json({ data: row }, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/pm/publish/route.ts`** (local-dev only):

```ts
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';
import { pmEnabled, resolveOutputPath } from '@/lib/server/pm';
import { parseOutputName } from '@/lib/productVideo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!pmEnabled()) {
    return Response.json({ error: 'Publishing runs only in local dev' }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await request.json();
  const feature = String(b?.feature ?? '');
  const name = String(b?.name ?? '');
  const filePath = resolveOutputPath(feature, name);
  if (!filePath) return Response.json({ error: 'Unknown output' }, { status: 400 });
  const meta = parseOutputName(name);
  if (!meta) return Response.json({ error: 'Unparseable output name' }, { status: 400 });

  const bytes = readFileSync(filePath);
  const blob = await put(`product/${feature}/${basename(name)}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'video/mp4',
  });

  const row = await prisma.productVideo.create({
    data: {
      ownerId: user.id,
      ownerEmail: user.email,
      feature,
      title: name.replace(/\.mp4$/, ''),
      length: meta.length,
      lang: meta.lang,
      orientation: meta.orientation,
      fileUrl: blob.url,
      mime: 'video/mp4',
      sizeBytes: bytes.length,
    },
  });
  return Response.json({ data: row }, { status: 201 });
}
```

- [ ] **Step 3: Typecheck** — `npm run typecheck` → PASS (requires the Prisma client from Task 1 Step 2 to include `productVideo`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/product-videos/route.ts src/app/api/pm/publish/route.ts
git commit -m "Add product-videos list/register + local pm/publish routes"
```

---

### Task 4: `ProductLibrary` grid component

**Files:**
- Create: `src/components/ProductLibrary.tsx`

**Interfaces:**
- Consumes: `LazyVideo` (`./LazyVideo`), `Spinner` (`./icons`).
- Produces: `ProductLibrary()` — client component, fetches `/api/product-videos`, renders a grid grouped by `feature`.

- [ ] **Step 1: Create `src/components/ProductLibrary.tsx`:**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { LazyVideo } from './LazyVideo';
import { Spinner } from './icons';

type ProductVideo = {
  id: string;
  feature: string;
  title: string;
  length: string;
  lang: string;
  orientation: string;
  fileUrl: string;
};

export function ProductLibrary() {
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/product-videos')
      .then((r) => r.json())
      .then((j) => setVideos(Array.isArray(j.data) ? j.data : []))
      .catch(() => setError('Could not load the product video library'))
      .finally(() => setLoading(false));
  }, []);

  const features = Array.from(new Set(videos.map((v) => v.feature)));

  return (
    <div>
      {loading && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}
      {error && <p className="text-[13px] text-brand">{error}</p>}
      {!loading && !error && videos.length === 0 && (
        <p className="text-[14px] text-faint">
          No published videos yet — build one locally and click “Publish to library”.
        </p>
      )}
      {features.map((feature) => (
        <div key={feature} className="mb-8">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">
            {feature}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos
              .filter((v) => v.feature === feature)
              .map((v) => (
                <div
                  key={v.id}
                  className="overflow-hidden rounded-xl border border-line bg-black"
                >
                  <div className={v.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'}>
                    <LazyVideo src={v.fileUrl} />
                  </div>
                  <div className="bg-surface px-2 py-1.5 text-[11px] font-medium text-muted">
                    {v.length} · {v.lang} · {v.orientation}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductLibrary.tsx
git commit -m "Add ProductLibrary grid (published PM videos)"
```

---

### Task 5: "Publish to library" button in `ProductBuilder`

**Files:**
- Modify: `src/components/ProductBuilder.tsx` (the "Rendered videos" list, around lines 301–320)

**Interfaces:**
- Consumes: `POST /api/pm/publish` (Task 3).

- [ ] **Step 1: Add publish state + handler** near the top of the `ProductBuilder` component body:

```tsx
  const [publishing, setPublishing] = useState<string | null>(null);
  const [published, setPublished] = useState<Set<string>>(new Set());

  async function publish(feature: string, name: string) {
    setPublishing(name);
    try {
      const r = await fetch('/api/pm/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, name }),
      });
      if (r.ok) setPublished((p) => new Set(p).add(name));
    } finally {
      setPublishing(null);
    }
  }
```

(If `useState` isn't imported yet, add it to the existing `react` import.)

- [ ] **Step 2: Render the button** in the rendered-outputs map (the block that builds `src = /api/pm/file?...` for each output `o`). After the `<video>` element for each output, add:

```tsx
                  <button
                    type="button"
                    onClick={() => publish(job.feature, o.name)}
                    disabled={publishing === o.name || published.has(o.name)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink transition hover:bg-line-soft disabled:opacity-60"
                  >
                    {published.has(o.name)
                      ? 'Published ✓'
                      : publishing === o.name
                        ? 'Publishing…'
                        : 'Publish to library'}
                  </button>
```

(Use the exact loop variable names present in the file — confirm `job.feature` and `o.name` by reading lines ~301–320 before editing.)

- [ ] **Step 3: Typecheck + lint** — `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductBuilder.tsx
git commit -m "Add Publish-to-library button to ProductBuilder outputs"
```

---

### Task 6: `/product` page — library first

**Files:**
- Modify: `src/app/product/page.tsx`

**Interfaces:**
- Consumes: `ProductLibrary` (Task 4).

- [ ] **Step 1: Import and reorder.** Add `import { ProductLibrary } from '../../components/ProductLibrary';`. After the capabilities grid, render the library as the primary section, then the builder as a secondary section. Replace the lone `<ProductBuilder />` with:

```tsx
        <div className="mt-10">
          <h2 className="mb-4 text-[18px] font-bold text-ink">Published videos</h2>
          <ProductLibrary />
        </div>
        <details className="mt-10 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-[14px] font-semibold text-ink">
            Build locally (dev)
          </summary>
          <ProductBuilder />
        </details>
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/product/page.tsx
git commit -m "Make /product library-first; builder in a dev section"
```

---

### Task 7: Gate + production db push (GATED) + verify + PR

**Files:** none (verification + delivery)

- [ ] **Step 1: Full gate** — `npm run check` → typecheck + lint + tests PASS.

- [ ] **Step 2: GATED production schema push.** Confirm with the user, then run
  `npx prisma db push` (applies the additive `ProductVideo` table to the
  production Neon DB via `.env.local` `DATABASE_URL`). Additive/no-data-loss, but
  it's a production schema change — do not run without the explicit go.

- [ ] **Step 3: Runtime verify (local).** `npm run dev`; on `/product`, open the
  "Build locally (dev)" section, click "Publish to library" on one existing
  render; confirm 201, then the video appears in the "Published videos" grid
  (which reads the prod DB). Confirm the grid lazy-loads.

- [ ] **Step 4: Push + PR.**

```bash
git push -u origin HEAD
gh pr create --title "Product-marketing video library (build local → publish to prod)" --body "..."
```

- [ ] **Step 5: Address review; merge when green.**

---

## Self-Review

**Spec coverage:** ProductVideo table → T1. Pure parser + test → T1. LazyVideo reuse → T2. list/register + publish routes → T3. Library grid → T4. Publish button → T5. Library-first page → T6. Gated prod push + verify → T7. ✓
**Placeholders:** none (T7 PR body filled at creation time). ✓
**Type consistency:** `parseOutputName`/`ProductVideoInput` (T1) consumed by T3; `prisma.productVideo` requires T1 Step 2 `prisma generate`; `LazyVideo({src})` (T2) consumed by T4; publish route body `{feature,name}` matches T5 button. ✓
