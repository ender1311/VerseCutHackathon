# Expand the background library — Design

**Date:** 2026-07-03
**Status:** Approved (pending spec review)

## Problem

The shared library has 407 `prerendered` verse images (verse text baked in) but
only ~120 text-free `prerendered_bg` backgrounds. We want a **much larger pool of
background-only images** (~300) for dynamic text overlays.

Investigation ruled out AI text-removal: the available Adobe MCP tools only build
selection masks and fill solid colors — no generative inpainting. But YouVersion's
Images API serves **native text-free renditions** (`category=prerendered_bg`), so
we fetch those directly instead of reconstructing them. Pixel-perfect, free.

## Source API

`GET https://images.youversionapi.com/3.2/items.json` — no auth; static headers
(`Referer`, `X-YouVersion-Client: youversion`, `X-YouVersion-App-Platform: internal`,
`X-YouVersion-App-Version: 1`). Params: `usfm[]` (repeatable), `language_tag`,
`category=prerendered_bg`, `page`. Response: `response.data.images[]` + `next_page`.

Each image: `{ id, category, language_tag, width, height, usfm[], urls.regular }`,
where `urls.regular` = `//imageproxy.youversionapi.com/{w}x{h}/https://s3.amazonaws.com/static-youversionapi-com/images/base/<id>/<w>x<h>.jpg`.
Full-res URL = fill `{w}x{h}` with the image's native width/height and prefix `https:`.

## Goal

Reach ~300 distinct `prerendered_bg` images in the library. Backgrounds are
verse-agnostic (reusable under any overlay), so iterate the canonical VOTD verse
set (316 USFMs, sourced from `alfred/votd`) × 4 languages (en/es/pt/fr), dedupe by
image `id`, and accumulate new backgrounds until the target is met.

## Non-goals

- No app/UI changes — the library already renders `prerendered_bg`.
- No changes to existing rows or to the ad-composited logo.
- No AI processing.

## Script — `scripts/seedBackgroundImages.mjs`

Self-contained Node ESM script (loads `.env.local` for `DATABASE_URL` +
`BLOB_READ_WRITE_TOKEN`).

1. **Load existing ids:** query `SharedAsset` where `source='youversion'` and
   `category='prerendered_bg'`; collect the YouVersion image ids already present
   (parsed from `name` `… · <id>`), to skip duplicates.
2. **Fetch:** for each USFM (embedded VOTD list) × language, page through
   `category=prerendered_bg`. Dedupe candidates by image `id` globally and against
   existing ids. Stop once `--target` (default 300) new unique images are collected.
3. **Persist (per image, only with `--commit`):**
   - Resolve full-res URL, download the JPEG.
   - `put` to Vercel Blob at `verse-images/<lang>/prerendered_bg-<id>-<rand>.jpg`
     (`access:'public'`, `contentType:'image/jpeg'`).
   - `prisma.sharedAsset.create` with: `ownerId:'verse-image-seed'`,
     `ownerEmail:'dan.luk@youversion.com'`, `kind:'image'`,
     `name:'YouVersion · <usfm> · <lang> · <id>'`, `fileUrl`, `mime:'image/jpeg'`,
     `sizeBytes`, `source:'youversion'`, `language`, `category:'prerendered_bg'`,
     `orientation` (from width/height, `height>width ? 'portrait' : 'landscape'`).

Flags: `--commit` (default dry-run), `--target N` (default 300), `--limit N`
(cap for the pilot), `--langs en,es,pt,fr`.

## Execution plan

1. Dry-run → report unique new backgrounds discovered + by language/orientation.
2. **Pilot:** `--commit --limit 8` to prod → review in the library UI.
3. **Scale:** `--commit --target 300` to prod.

## Verification

- Dry-run counts before any write.
- Post-commit: DB counts by `category` / `language` / `orientation`.
- Spot-check thumbnails in the YouVersion → Backgrounds library tab.
- `npm run check` green (script is standalone; no src changes expected).

## Risks

- Writes to **production** Blob + DB (shared). Mitigated by dry-run + pilot gate.
- Some backgrounds repeat across verses/langs — dedup by image `id` handles it.
- Idempotent: re-runs skip ids already in the DB.
