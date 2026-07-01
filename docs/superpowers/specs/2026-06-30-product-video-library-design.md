# Product-Marketing Video Library — Design

**Date:** 2026-06-30
**Status:** Approved

## Problem

Product-marketing videos are rendered by a local-dev-only pipeline
(`ProductBuilder` + `/api/pm/*`) and exist only as files on the developer's Mac
(`videos/product/out/<feature>/…`, 5 so far for the `reading-plans` feature).
Nothing persists them, and the `/product` tab shows only the local builder — so
the videos aren't viewable in production or by teammates. We want to **build
locally, publish to production** (Neon DB + Vercel Blob), and show the published
library on the `/product` tab.

## Goals

- Persist product-marketing videos in the production database, distinct from the
  ad `SharedAsset` background library.
- A "Publish to library" action in the local builder that uploads a rendered
  output to Blob and inserts a DB row (writes go to production).
- The `/product` tab shows the published library as its primary content (works in
  production); the local builder becomes a secondary section.

## Non-goals

- No change to the render pipeline itself or to the ads/social spaces.
- No backfill script — the existing 5 renders are published via the new button.
- PM videos never appear in the ads Background library (separate table).

## Data model — new `ProductVideo`

`prisma/schema.prisma` (additive; requires `prisma db push` to the production DB
— confirmed with the user before running):

```prisma
/// A published product-marketing video (built locally, published to prod).
model ProductVideo {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  ownerId     String
  ownerEmail  String
  feature     String
  title       String
  length      String   // 'short' | 'long'
  lang        String
  orientation String   // 'portrait' | 'landscape'
  fileUrl     String
  mime        String?
  sizeBytes   Int?

  @@index([feature])
  @@index([createdAt])
}
```

## Pure logic

`src/lib/productVideo.ts`:
- `parseOutputName(name: string): { length: string; lang: string; orientation: string } | null`
  — parses `<feature>-<length>-<lang>-<orientation>.mp4` (the same regex
  `listOutputs` uses in `pm.ts`), returning null if it doesn't match. Unit-tested.
- `type ProductVideoInput` describing the row fields written by the publish route.

## API

- **`GET /api/product-videos`** — authed; returns `{ data: ProductVideo[] }`
  ordered `createdAt desc`, `take: 500`. Works in production.
- **`POST /api/product-videos`** — authed; registers a row. Body requires
  `feature,title,length,lang,orientation,fileUrl,mime?,sizeBytes?`; rejects
  unless `isManagedBlobUrl(fileUrl)` (reuse `src/lib/server/blob.ts`). Returns 201.
- **`POST /api/pm/publish`** — **local-dev only** (`pmEnabled()` guard, like the
  other `/api/pm/*`). Body `{ feature, name }`. Steps: `resolveOutputPath` →
  read the file → `put()` to Blob (`access:'public'`, `addRandomSuffix:true`,
  `contentType:'video/mp4'`) → `parseOutputName` for metadata → POST the row via
  the same DB insert (or call the create helper directly) → return the created
  row. Because `.env.local` `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN` point at
  production, publishing from the Mac lands in prod.

## UI

- **`ProductLibrary.tsx`** — fetches `/api/product-videos`, renders a lazy-loaded
  grid reusing the top-first `LazyVideo` streaming pattern (extract `LazyVideo`
  from `ImageLibrary.tsx` into `src/components/LazyVideo.tsx` so both reuse it).
  Group by `feature`; each card labeled `length · lang · orientation`.
- **`ProductBuilder.tsx`** — add a "Publish to library" button per rendered
  output; on success mark it published (track published names in state, disable
  the button). Calls `POST /api/pm/publish`.
- **`src/app/product/page.tsx`** — library-first: keep the intro copy, render
  `<ProductLibrary />` as primary content, move `<ProductBuilder />` into a
  secondary "Build locally (dev)" section below it.

## Testing / verification

- `parseOutputName` unit-tested (valid short/long, es/en, portrait/landscape,
  and non-matching names → null).
- Runtime: locally publish one of the 5 renders → confirm it uploads to Blob,
  inserts a `ProductVideo` row, and appears in the `/product` library grid.
- `npm run check` green; subagent-driven build with per-task + final review.

## Decisions (confirmed)

- New `ProductVideo` table (not `SharedAsset`).
- Publish via an in-builder **"Publish to library"** button (no backfill script).
- `/product` shows the **library first**, builder secondary.
- Videos live in the **production** DB + Blob; build local, publish to prod.
- The production `prisma db push` is gated on explicit user confirmation.
