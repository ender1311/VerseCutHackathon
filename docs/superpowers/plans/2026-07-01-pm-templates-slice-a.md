# PM Templates Slice A Implementation Plan (assets + data + renderer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Ship faithful Figma assets + typed template data + a canvas renderer for 4 iOS marketing-screenshot templates (Today, Reader, Plans, Prayers), verifiable via a dev preview. No DB/editor (Slices B/C).

**Architecture:** Assets exported from the Figma "App Store collection" into `/public/assets/product-templates/`; a typed `productTemplates.ts` capturing per-template geometry; a canvas `templateCompositor.ts` (`renderTemplate → PNG`) mirroring `render.ts`'s `renderImage`; pure cover-fit + word-wrap math unit-tested; a dev-only preview page.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Canvas 2D · Vitest · Figma MCP (extraction).

## Global Constraints

- No `any`; new pure logic in `src/lib/` gets a `*.test.ts`; relative imports inside `src/`.
- Canvas render mirrors `renderImage` in `src/lib/render.ts` (offscreen canvas + `toBlob`).
- Assets live in `public/assets/product-templates/`; `iconCatalog`-style data is hand-authored here (not auto-generated).
- `npm run check` must pass before pushing.
- iOS iPhone 14 Pro only; templates: today, reader, plans, prayers.
- Device frame is drawn ON TOP of the screen image (transparent screen cutout); screen image is cover-fit (center-crop) into `screenSlot`, clipped to its rounded rect.

---

### Task 1: Extract Figma assets + author template data  *(controller-led — interactive Figma MCP)*

**Files:**
- Create: `public/assets/product-templates/frame-iphone-14-pro.png` (+ `bg-*.png` / `logo.png` as needed)
- Create: `src/lib/productTemplates.ts`

**Interfaces:**
- Produces: the `ProductTemplate`/`Rect`/`TemplateText`/`TemplatePlatform` types (exact shape in the spec's "Template data" section) and `export const PRODUCT_TEMPLATES: ProductTemplate[]` with the 4 templates populated from real Figma geometry.

- [ ] **Step 1: Locate the iOS template frames.** In the Figma file `SYWteUpd8knkgmPrTvFTlJ`, use `get_metadata` to find the four iOS frames for Today, Reader, Plans, Prayers (iPhone 14 Pro variants; the collection also has `android/*` frames — pick the iOS ones). Record each frame's node id + size and, within it, the device-frame node, the `Screen (Replace Here)` slot node, and the Title/Description text nodes, with absolute rects.

- [ ] **Step 2: Export assets.** Export the iPhone 14 Pro device frame as a transparent PNG (`get_screenshot` on the device-frame node with a transparent screen area, or download the asset) → `frame-iphone-14-pro.png`. Export each template's background (flat brand color → record the hex instead; pattern → `bg-<id>.png`). Export the YouVersion logo if the template uses one (or reuse `public/assets/icons/...`). Confirm the canvas size (App Store 6.7" is 1290×2796; use the frame's actual size).

- [ ] **Step 3: Author `src/lib/productTemplates.ts`.** Write the types (verbatim from the spec) and `PRODUCT_TEMPLATES` with the four templates, using the rects/sizes captured in Steps 1–2 (deviceRect, screenSlot+radius, title/subhead rect+font+size+weight+color+align+lineHeight, background). Default copy: use each Figma template's Title/Description text.

- [ ] **Step 4: Add a data-integrity test** `src/lib/productTemplates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PRODUCT_TEMPLATES } from './productTemplates';

describe('PRODUCT_TEMPLATES', () => {
  it('has the four iOS templates with valid geometry', () => {
    expect(PRODUCT_TEMPLATES.map((t) => t.id).sort()).toEqual(
      ['plans', 'prayers', 'reader', 'today'],
    );
    for (const t of PRODUCT_TEMPLATES) {
      expect(t.platform).toBe('ios');
      expect(t.canvas.w).toBeGreaterThan(0);
      expect(t.canvas.h).toBeGreaterThan(0);
      // screen slot must sit within the canvas
      expect(t.screenSlot.x).toBeGreaterThanOrEqual(0);
      expect(t.screenSlot.y).toBeGreaterThanOrEqual(0);
      expect(t.screenSlot.x + t.screenSlot.w).toBeLessThanOrEqual(t.canvas.w);
      expect(t.screenSlot.y + t.screenSlot.h).toBeLessThanOrEqual(t.canvas.h);
    }
  });
});
```

- [ ] **Step 5: Verify + commit.** `npm run test -- productTemplates` → PASS. Confirm asset files exist under `public/assets/product-templates/`.

```bash
git add public/assets/product-templates src/lib/productTemplates.ts src/lib/productTemplates.test.ts
git commit -m "Add iOS template assets + typed template data (Today/Reader/Plans/Prayers)"
```

---

### Task 2: `coverRect` pure geometry + tests

**Files:**
- Create: `src/lib/templateGeometry.ts`
- Test: `src/lib/templateGeometry.test.ts`

**Interfaces:**
- Consumes: `Rect` (import type from `./productTemplates`).
- Produces: `coverRect(slot: Rect, imgW: number, imgH: number): { sx:number; sy:number; sw:number; sh:number; dx:number; dy:number; dw:number; dh:number }` — source-crop + destination rects to cover-fit (center-crop) an image into `slot`.

- [ ] **Step 1: Write the failing test** `src/lib/templateGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { coverRect } from './templateGeometry';

const slot = { x: 100, y: 200, w: 400, h: 800 }; // portrait slot, ratio 0.5

describe('coverRect', () => {
  it('crops the sides of a too-wide image', () => {
    const r = coverRect(slot, 800, 800); // square, wider ratio than slot
    expect(r.dx).toBe(100);
    expect(r.dy).toBe(200);
    expect(r.dw).toBe(400);
    expect(r.dh).toBe(800);
    expect(r.sh).toBe(800);        // full height used
    expect(r.sw).toBeCloseTo(400); // cropped width (800*0.5)
    expect(r.sx).toBeCloseTo(200); // centered crop
    expect(r.sy).toBe(0);
  });
  it('crops top/bottom of a too-tall image', () => {
    const r = coverRect(slot, 400, 1600); // ratio 0.25, taller than slot
    expect(r.sw).toBe(400);
    expect(r.sh).toBeCloseTo(800); // 400/0.5
    expect(r.sx).toBe(0);
    expect(r.sy).toBeCloseTo(400); // centered
  });
  it('no crop when ratios match', () => {
    const r = coverRect(slot, 400, 800);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
    expect(r.sw).toBe(400);
    expect(r.sh).toBe(800);
  });
  it('guards degenerate image sizes', () => {
    const r = coverRect(slot, 0, 0);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0, dx: 100, dy: 200, dw: 400, dh: 800 });
  });
});
```

- [ ] **Step 2: Run (expect fail)** — `npm run test -- templateGeometry` → FAIL.

- [ ] **Step 3: Implement** `src/lib/templateGeometry.ts`:

```ts
import type { Rect } from './productTemplates';

export function coverRect(
  slot: Rect,
  imgW: number,
  imgH: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const dest = { dx: slot.x, dy: slot.y, dw: slot.w, dh: slot.h };
  if (imgW <= 0 || imgH <= 0) return { sx: 0, sy: 0, sw: 0, sh: 0, ...dest };
  const slotRatio = slot.w / slot.h;
  const imgRatio = imgW / imgH;
  let sw = imgW;
  let sh = imgH;
  if (imgRatio > slotRatio) {
    // image too wide -> crop width
    sw = imgH * slotRatio;
  } else {
    // image too tall -> crop height
    sh = imgW / slotRatio;
  }
  const sx = (imgW - sw) / 2;
  const sy = (imgH - sh) / 2;
  return { sx, sy, sw, sh, ...dest };
}
```

- [ ] **Step 4: Run (expect pass)** — `npm run test -- templateGeometry` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templateGeometry.ts src/lib/templateGeometry.test.ts
git commit -m "Add coverRect cover-fit geometry + tests"
```

---

### Task 3: `wrapLines` pure text-wrap helper + tests

**Files:**
- Create: `src/lib/templateText.ts`
- Test: `src/lib/templateText.test.ts`

**Interfaces:**
- Produces: `wrapLines(measure: (s: string) => number, text: string, maxWidth: number): string[]` — greedy word-wrap using an injected width-measure fn (so it's pure/testable without canvas).

- [ ] **Step 1: Write the failing test** `src/lib/templateText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { wrapLines } from './templateText';

// fake measure: 1 unit per character
const measure = (s: string) => s.length;

describe('wrapLines', () => {
  it('wraps on word boundaries within maxWidth', () => {
    expect(wrapLines(measure, 'get things done easily', 11)).toEqual([
      'get things',
      'done easily',
    ]);
  });
  it('keeps a single word that exceeds maxWidth on its own line', () => {
    expect(wrapLines(measure, 'supercalifragilistic word', 10)).toEqual([
      'supercalifragilistic',
      'word',
    ]);
  });
  it('returns [] for empty text', () => {
    expect(wrapLines(measure, '   ', 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run (expect fail)** — `npm run test -- templateText` → FAIL.

- [ ] **Step 3: Implement** `src/lib/templateText.ts`:

```ts
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}
```

- [ ] **Step 4: Run (expect pass)** — `npm run test -- templateText` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templateText.ts src/lib/templateText.test.ts
git commit -m "Add wrapLines word-wrap helper + tests"
```

---

### Task 4: `templateCompositor` — draw + render to PNG

**Files:**
- Create: `src/lib/templateCompositor.ts`

**Interfaces:**
- Consumes: `PRODUCT_TEMPLATES`/`ProductTemplate`/`Rect`/`TemplateText` (`./productTemplates`), `coverRect` (`./templateGeometry`), `wrapLines` (`./templateText`), `ensureFontsReady` (`./compositor`).
- Produces: `composeTemplate(ctx: CanvasRenderingContext2D, template: ProductTemplate, fills: TemplateFills, assets: TemplateAssets): void`; `renderTemplate(template: ProductTemplate, fills: TemplateFills): Promise<Blob>`; `type TemplateFills = { screenImage?: CanvasImageSource; title?: string; subhead?: string }`.

- [ ] **Step 1: Implement `src/lib/templateCompositor.ts`.** Draw order: background (fill `background.color` or draw `background.asset` image) → if `screenImage`: clip to rounded `screenSlot` and draw via `coverRect`; else fill the slot with a neutral placeholder (`#e7e7ea`) → draw the device frame image at `deviceRect` → draw title (wrapped via `wrapLines` with `ctx.measureText`) and subhead within their rects using their font/size/weight/color/align/lineHeight → draw logo if present. `renderTemplate` creates an offscreen `<canvas>` at `template.canvas`, `await ensureFontsReady()`, loads the needed images (device frame, background asset, logo) via a small `loadImage(url)` helper (returns `HTMLImageElement`), calls `composeTemplate`, and resolves `canvas.toBlob(..., 'image/png')` (reject on null blob) — mirroring `renderImage` in `render.ts`.

```ts
'use client';

import type { ProductTemplate, Rect, TemplateText } from './productTemplates';
import { coverRect } from './templateGeometry';
import { wrapLines } from './templateText';
import { ensureFontsReady } from './compositor';

export type TemplateFills = { screenImage?: CanvasImageSource; title?: string; subhead?: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const rr = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rr, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, t: TemplateText, override?: string) {
  const text = override ?? t.text;
  ctx.save();
  ctx.font = `${t.weight} ${t.size}px ${t.font}`;
  ctx.fillStyle = t.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = t.align;
  const lines = wrapLines((s) => ctx.measureText(s).width, text, t.rect.w);
  const anchorX = t.align === 'left' ? t.rect.x : t.align === 'right' ? t.rect.x + t.rect.w : t.rect.x + t.rect.w / 2;
  lines.forEach((line, i) => ctx.fillText(line, anchorX, t.rect.y + i * t.lineHeight));
  ctx.restore();
}

export function composeTemplate(
  ctx: CanvasRenderingContext2D,
  template: ProductTemplate,
  fills: TemplateFills,
  assets: { frame: HTMLImageElement; background?: HTMLImageElement; logo?: HTMLImageElement },
) {
  const { canvas, screenSlot } = template;
  // background
  if ('color' in template.background) {
    ctx.fillStyle = template.background.color;
    ctx.fillRect(0, 0, canvas.w, canvas.h);
  } else if (assets.background) {
    ctx.drawImage(assets.background, 0, 0, canvas.w, canvas.h);
  }
  // screen (under the frame)
  ctx.save();
  roundedRectPath(ctx, screenSlot, screenSlot.radius);
  ctx.clip();
  if (fills.screenImage) {
    const w = (fills.screenImage as HTMLImageElement).naturalWidth ?? screenSlot.w;
    const h = (fills.screenImage as HTMLImageElement).naturalHeight ?? screenSlot.h;
    const c = coverRect(screenSlot, w, h);
    ctx.drawImage(fills.screenImage, c.sx, c.sy, c.sw, c.sh, c.dx, c.dy, c.dw, c.dh);
  } else {
    ctx.fillStyle = '#e7e7ea';
    ctx.fillRect(screenSlot.x, screenSlot.y, screenSlot.w, screenSlot.h);
  }
  ctx.restore();
  // device frame on top
  const d = template.deviceRect;
  ctx.drawImage(assets.frame, d.x, d.y, d.w, d.h);
  // text
  drawText(ctx, template.title, fills.title);
  drawText(ctx, template.subhead, fills.subhead);
  // logo
  if (template.logo && assets.logo) {
    const l = template.logo.rect;
    ctx.drawImage(assets.logo, l.x, l.y, l.w, l.h);
  }
}

export async function renderTemplate(template: ProductTemplate, fills: TemplateFills): Promise<Blob> {
  await ensureFontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = template.canvas.w;
  canvas.height = template.canvas.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const frame = await loadImage(template.deviceFrameAsset);
  const background = 'asset' in template.background ? await loadImage(template.background.asset) : undefined;
  const logo = template.logo ? await loadImage(template.logo.asset) : undefined;
  composeTemplate(ctx, template, fills, { frame, background, logo });
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → PASS. (`ensureFontsReady` is exported from `compositor.ts` — confirmed.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/templateCompositor.ts
git commit -m "Add templateCompositor (compose + render to PNG)"
```

---

### Task 5: Dev preview page

**Files:**
- Create: `src/app/product/_template-preview/page.tsx`
- Create: `public/assets/product-templates/sample-screen.png` (a bundled sample in-app screen for preview — reuse an existing screenshot or export one from Figma)

**Interfaces:**
- Consumes: `PRODUCT_TEMPLATES` (`@/lib/productTemplates`), `renderTemplate` (`@/lib/templateCompositor`).

- [ ] **Step 1: Create the client preview page** `src/app/product/_template-preview/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { PRODUCT_TEMPLATES } from '@/lib/productTemplates';
import { renderTemplate } from '@/lib/templateCompositor';

export default function TemplatePreview() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const sample = await new Promise<HTMLImageElement>((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = '/assets/product-templates/sample-screen.png';
      });
      for (const t of PRODUCT_TEMPLATES) {
        const blob = await renderTemplate(t, { screenImage: sample });
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        setUrls((u) => ({ ...u, [t.id]: url }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="grid grid-cols-2 gap-6 p-8 lg:grid-cols-4">
      {PRODUCT_TEMPLATES.map((t) => (
        <figure key={t.id}>
          <figcaption className="mb-2 text-[13px] font-semibold text-ink">{t.name}</figcaption>
          {urls[t.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[t.id]} alt={t.name} className="w-full rounded-xl border border-line" />
          ) : (
            <div className="aspect-[9/19] w-full animate-pulse rounded-xl bg-line-soft" />
          )}
        </figure>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/product/_template-preview/page.tsx public/assets/product-templates/sample-screen.png
git commit -m "Add dev-only template preview page"
```

---

### Task 6: Gate + visual verify + PR

**Files:** none.

- [ ] **Step 1: Full gate** — `npm run check` → PASS (typecheck + lint + tests incl. productTemplates/templateGeometry/templateText).

- [ ] **Step 2: Visual verify.** `npm run dev`; open `http://localhost:3000/product/_template-preview`; confirm all four templates render with the device frame aligned over the sample screen, the screen cover-fit into the slot, and the title/subhead placed correctly. Screenshot each.

- [ ] **Step 3: Push + PR** (title "PM marketing-screenshot templates — Slice A (assets + renderer)"), summarizing the four templates + the dev preview and noting Slices B/C follow.

- [ ] **Step 4: Address review; merge when green.**

---

## Self-Review

**Spec coverage:** faithful assets + geometry → Task 1. Template data/types → Task 1. `coverRect` → Task 2. word-wrap → Task 3. `templateCompositor`/`renderTemplate` → Task 4. dev preview → Task 5. tests + visual verify → Tasks 2/3/4/6. ✓
**Placeholders:** Task 1 geometry values are produced by the extraction (real numbers authored into `productTemplates.ts`), not left as prose placeholders; all coded tasks carry full code. ✓
**Type consistency:** `Rect`/`ProductTemplate`/`TemplateText` defined in Task 1, consumed by Tasks 2/4; `coverRect` signature (Task 2) matches its use in Task 4; `wrapLines` signature (Task 3) matches Task 4; `TemplateFills`/`renderTemplate` (Task 4) match Task 5. ✓

## Note on execution

Task 1 is controller-led (interactive Figma MCP asset export + geometry capture); Tasks 2–5 are standard implementer tasks. Verify Task 1's assets/geometry before dispatching downstream tasks that depend on them.
