# Library Taxonomy — Design (source / language / category / orientation)

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## Problem

The shared library (`SharedAsset`) mixes three provenances — YouVersion verse
images, Unsplash stock photos, Pexels videos — with no metadata beyond `name` +
`kind`. The user wants the library organized: a **YouVersion** tab (grouped by
language), an **Unsplash** tab, and the existing **Videos** tab, with the ability
to filter YouVersion assets by category (Background vs Verse image) and
orientation. The YouVersion Images API exposes `language_tag`, `category`
(`prerendered` = verse text baked in, `prerendered_bg` = text-free background),
`usfm`, `version_id`, and dimensions.

## Goals

- Store first-class metadata on `SharedAsset`: `source`, `language`, `category`,
  `orientation` (all nullable/additive).
- Tag existing rows: Unsplash images → `unsplash`, Pexels videos → `pexels`, the
  141 seeded verse images → `youversion` (+ language/category/orientation).
- Add YouVersion **background-only** (`prerendered_bg`) images alongside the
  existing verse-text ones, both tagged by category.
- Right panel: **source tabs** (YouVersion / Unsplash / Videos); within
  YouVersion, group by language with category + orientation filters.

## Non-goals

- No change to video sourcing or the Pexels set.
- No per-verse or per-Bible-version UI (metadata stored, but not surfaced yet).
- No deletion of existing assets; re-seed only adds + backfills.

## Slices

- **Slice 1 (data):** schema columns + pure taxonomy helpers (+ tests) + library
  type/API surfacing the fields + a backfill/re-seed script. Gated prod
  migration + writes.
- **Slice 2 (UI):** source tabs + language grouping + category/orientation
  filters in the library browser.

## Data model

`SharedAsset` gains (all `String?`, additive — safe `prisma db push`):
- `source` — `'youversion' | 'unsplash' | 'pexels'`
- `language` — BCP-ish tag (`en`, `es`, `pt`, `fr`) — null for non-localized
- `category` — `'prerendered' | 'prerendered_bg'` (YouVersion) — null otherwise
- `orientation` — `'portrait' | 'landscape'`

## Pure logic — `src/lib/assetTaxonomy.ts`

- `type AssetSource = 'youversion' | 'unsplash' | 'pexels' | 'other'`
- `deriveSource(name: string): AssetSource` — name prefix (`YouVersion`/`Unsplash`/`Pexels`) → source; fallback `'other'`. Used for backfill.
- `orientationOf(width: number, height: number): 'portrait' | 'landscape'`
- `parseYouVersionName(name)`: extract `{ usfm, language, id }` from
  `YouVersion · <usfm> · <lang> · <id>` (for backfilling language on the 141).
All unit-tested.

## Backfill + re-seed (script, gated)

`scripts/seedVerseImages.mjs` (recreated) + a backfill pass:
1. **Backfill existing** rows via one `prisma` update pass:
   - `source='unsplash'` where name starts `Unsplash`
   - `source='pexels'` where name starts `Pexels`
   - `source='youversion', category='prerendered', orientation='portrait'`,
     `language=<parsed>` for the 141 (all seeded portrait/prerendered).
2. **Add** `prerendered_bg` (both orientations) and `prerendered` landscape for
   the 12 verses × 4 langs, deduped by image id, storing
   source/language/category/orientation + `© YouVersion`. Fetch via Images API
   (`category=prerendered_bg` and `prerendered`; both orientations).
Dry-run prints counts; `--commit` writes to prod Blob + DB after confirmation.
The prod `prisma db push` is gated on explicit user confirmation.

## API / types

- `src/lib/library.ts` `SharedAsset` type gains the four optional fields.
- `GET /api/uploads` already returns full rows (`findMany`) — no change needed
  beyond the type; confirm the new columns flow through.

## UI (Slice 2 summary)

- `RightView` becomes `'output' | 'videos' | 'youversion' | 'unsplash'`.
- Tabs: **Preview · YouVersion · Unsplash · Videos**.
- Library browser parameterized by `{ kind, source }`; YouVersion view groups by
  `language` and offers **category** (Background / Verse image) + **orientation**
  filter chips. Unsplash view = images, source unsplash. Videos = kind video.
- Mobile sub-toggle mirrors the source tabs.

## Testing / verification

- `assetTaxonomy` helpers unit-tested (deriveSource, orientationOf, parseYouVersionName).
- Backfill/seed: dry-run counts; post-write DB counts by source/category/orientation.
- UI verified in-browser (Playwright unavailable — manual).
- `npm run check` green each slice.

## Decisions (confirmed)

- Both `prerendered` + `prerendered_bg`, tagged by category.
- Source tabs (YouVersion / Unsplash / Videos) + group YouVersion by language.
- Add `source/language/category/orientation` columns + re-seed (additive prod
  migration, gated).
- Non-YouVersion images = Unsplash; videos = Pexels.
