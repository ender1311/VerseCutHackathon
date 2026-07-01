# PM Marketing-Screenshot Templates — Slice A (assets + data + renderer)

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Context

We're adding an App-Store-style marketing-screenshot template system to the
Product Marketing space, based on the Figma "App Store collection"
(`SYWteUpd8knkgmPrTvFTlJ`). Each template is a branded background + headline +
subhead + a device frame whose inner **"Screen (Replace Here)"** slot is filled
with an in-app view (Today feed, Reader, Plans, Prayers), later swapped for
localized/updated grabs. The full editor (browse → fill → edit copy → export
PNG) is being built in three slices:

- **Slice A (this spec):** faithful Figma assets + typed template data + a
  canvas renderer, verifiable via a minimal dev preview. No DB, no real editor.
- Slice B: `AppScreen` screens library (DB + upload/list API).
- Slice C: Templates gallery + `TemplateEditor` UI on `/product`, wired to A+B.

## Goals (Slice A)

- Export faithful assets for **4 iOS templates** — **Today, Reader, Plans,
  Prayers** (iPhone 14 Pro frame) — from the Figma collection into `/public`.
- A typed template-definition module capturing each template's geometry.
- A canvas renderer that composites a template + a screen image + copy into a
  PNG, mirroring the existing `renderImage` pattern.
- Pure geometry math (screen cover-fit into the slot) unit-tested.
- A minimal, dev-only preview to visually verify each template renders.

## Non-goals (Slice A)

- No `AppScreen` DB model / upload API (Slice B).
- No production gallery or editor UI, no publish/save (Slice C).
- No Android templates yet; iOS iPhone 14 Pro only.

## Assets (faithful, from Figma)

Exported into `public/assets/product-templates/`:
- `frame-iphone-14-pro.png` — the device frame as a transparent PNG with a
  transparent screen cutout (drawn ON TOP of the screen image).
- Per-template background assets `bg-<template>.png` (brand pattern/color) at
  full canvas size — OR, where a template's background is a flat brand color,
  record the color instead of an asset.
- `logo.png` (or reuse the existing brand logo asset if identical).

Extraction method: use the Figma MCP (`get_metadata` to locate the four iOS
template frames + their `Screen (Replace Here)` slot and device nodes;
`get_screenshot`/asset download for the frame, backgrounds, logo). Record each
node's absolute rect to derive geometry (below). The canvas size is the App
Store 6.7" portrait size **1290 × 2796** (confirm against the Figma frame size;
use the frame's actual size if different).

## Template data — `src/lib/productTemplates.ts`

```ts
export type TemplatePlatform = 'ios';
export interface Rect { x: number; y: number; w: number; h: number }
export interface TemplateText {
  text: string;      // default copy (editable later in Slice C)
  rect: Rect;        // layout box
  font: string;      // css font-family
  size: number;      // px
  weight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}
export interface ProductTemplate {
  id: string;                 // 'today' | 'reader' | 'plans' | 'prayers'
  name: string;               // display name
  feature: string;
  platform: TemplatePlatform; // 'ios'
  canvas: { w: number; h: number };
  background: { color: string } | { asset: string };
  deviceFrameAsset: string;   // /assets/product-templates/frame-iphone-14-pro.png
  deviceRect: Rect;           // where the frame is drawn on the canvas
  screenSlot: Rect & { radius: number }; // where the screen image goes (under the frame)
  title: TemplateText;
  subhead: TemplateText;
  logo?: { asset: string; rect: Rect };
}
export const PRODUCT_TEMPLATES: ProductTemplate[];
```

Values for the four templates come from the Figma geometry captured during
implementation (exact numbers live in this file, not the plan prose).

## Renderer — `src/lib/templateCompositor.ts`

- `coverRect(slot: Rect, imgW: number, imgH: number): { sx; sy; sw; sh; dx; dy; dw; dh }`
  — **pure**; computes source/destination rects to cover-fit a screen image into
  the slot without distortion (center-crop). Unit-tested.
- `composeTemplate(ctx, template, fills)` where
  `fills = { screenImage?: CanvasImageSource; title?: string; subhead?: string }`
  — draws in order: background (color fill or bg image) → screen image
  cover-fit + clipped to `screenSlot` (rounded rect) → device frame PNG over the
  slot → title text (wrapped in `title.rect`) → subhead text → logo. Falls back
  to a neutral placeholder in the slot when `screenImage` is absent.
- `renderTemplate(template, fills): Promise<Blob>` — offscreen canvas at
  `template.canvas` size, `ensureFontsReady()`, `composeTemplate`, `toBlob('image/png')`.
  Mirrors `render.ts`'s `renderImage`.

Text wrapping reuses the existing word-wrap helper in `compositor.ts` if
exportable; otherwise a small local wrapper (kept pure, tested for the
line-breaking of a long title).

## Dev preview (verification only)

A dev-only route `src/app/product/_template-preview/page.tsx` that, for each
template, renders `renderTemplate(template, { screenImage: <a bundled sample
screen> })` to an `<img>` (object URL). Used to eyeball fidelity + screenshot in
QA. Clearly interim — Slice C replaces it with the real gallery/editor. Guarded
so it isn't linked from the main UI.

## Testing / verification

- `coverRect` unit tests: wider-than-slot image (crops sides), taller image
  (crops top/bottom), exact-ratio (no crop), zero/degenerate guarded.
- Word-wrap helper test if a local one is added.
- Runtime: the dev preview renders all four templates with a sample screen;
  visually verify device frame alignment, slot fit, and text placement; screenshot.
- `npm run check` green.

## Decisions (confirmed)

- Full editor built in slices A→B→C; this is Slice A.
- Faithful Figma assets (device frame, backgrounds, logo) exported to `/public`.
- Canvas compositor + `toBlob` (consistent with `renderImage`).
- Starting templates: **Today, Reader, Plans, Prayers** (iOS / iPhone 14 Pro).
- Screen source (upload + library) is Slice B/C; Slice A renders a provided
  `CanvasImageSource` and a placeholder when none is given.
