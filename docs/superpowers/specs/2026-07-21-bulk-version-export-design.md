# Bulk Version Export — Design Spec

**Date:** 2026-07-21
**Status:** Approved (pending spec review)

## Goal

Add a **Bulk Export** feature: pick one verse reference, render a branded verse
asset (app icon or lockup) for **every** Bible version in the catalog (~3,700
versions across 2,448 languages), upload each rendered image to **AIR**
(air.inc), and emit three CSV files:

1. **versions.csv** — one row per version: version id, localized reference,
   localized verse text, and the AIR CDN link to the rendered asset.
2. **geo-backgrounds-by-country.csv** — geo-targeted landmark background images
   (from Unsplash), one row per country, filtered to be non-political and
   non-religious.
3. **geo-backgrounds-by-language.csv** — the same images mapped to each language
   (one row per language → its country's images).

Both geo CSVs are built from the same deduped, safety-filtered Unsplash query
results, so they never disagree — they are just two views of the same data.

## Non-goals

- Server-side rendering. Rendering reuses the existing client-side Canvas
  pipeline (`renderImage` / `composeFrame`).
- Per-language localized logos beyond the 66 that already ship art. The long
  tail uses the **English icon-only** Bible App mark (no wordmark) as a fallback
  (see Decisions).
- Video output. Bulk export is images only.
- Compositing geo backgrounds into the version assets. The version batch uses a
  single shared background; geo images live only in the geo CSVs.

## Key decisions (resolved during brainstorming)

- **Scale:** every version (~3,700). One CSV row per version id.
- **Logo fallback:** the 66 languages with localized art use it in the chosen
  style (via `resolveLogoFile`). Every other language uses the **English
  icon-only** Bible App mark — the plain app icon with **no "Bible App"
  wordmark** — regardless of the batch's chosen style, and never a lockup. This
  avoids stamping English wordmark text onto a non-English version. A scan
  confirmed the fallback chain resolves exactly 66 languages — the long tail are
  genuinely distinct languages (e.g. `aau` Abau, `acr` Achi), not script/region
  variants, so no localized art exists for them. Verse **reference** and **text**
  are still localized for all ~3,700.
- **Output format:** two separate CSV files (not a multi-sheet workbook).
- **Geo derivation:** derive a primary country per language; source Unsplash
  landmark images per country (deduped queries), then emit **both** a
  per-country CSV and a per-language CSV from the same results.
- **Version-asset background:** one shared background chosen for the whole batch.
- **CDN target:** AIR (air.inc). Reference implementation:
  `/Users/danluk/repos/alfred/air_upload/client.py`.

## Architecture

Client-driven batch with a server-side AIR proxy. The browser owns the loop and
rendering; the server owns the credentialed AIR + Unsplash calls.

```
Bulk Export tab (/export, client)
  ├─ resolve scope → list of versions (from bible-manifest.json)
  ├─ for each version (concurrency pool ~8–12):
  │     fetch verse text + localized ref   → internal reader API (/api/yvb)
  │     resolve logo (localized style | English icon-only) → resolveBulkLogo
  │     renderImage(...)                    → Blob (existing compositor)
  │     POST blob                           → /api/air/upload → { cdn_url }
  │     push row { version_id, reference, verse_text, air_cdn_link }
  ├─ checkpoint completed version ids       → localStorage (resume on re-run)
  └─ build + download versions.csv

Geo backgrounds (separate action, same tab)
  ├─ languages → primary country (committed table)
  ├─ dedupe by country → Unsplash landmark queries (curated + safety filter)
  └─ build + download BOTH:
        geo-backgrounds-by-country.csv   (one row per country)
        geo-backgrounds-by-language.csv  (one row per language → its country's images)
```

### Why client-driven

Reuses the entire existing render/compositor/font stack (`renderImage`,
`composeFrame`, `ensureFontsReady`) with zero re-implementation. AIR and Unsplash
keys stay server-side behind thin proxy routes. A `localStorage` checkpoint of
completed version ids makes a re-run resume rather than restart, recovering most
of a server job's durability for a fraction of the effort.

## Components

### 1. UI — Bulk Export space (`/export`)

- Add `{ href: '/export', label: 'Bulk Export' }` to `SpaceSwitcher`.
- New route `src/app/export/page.tsx` (server: `withAuth` → client shell).
- Controls:
  - Verse reference picker (reuse existing input components).
  - Logo **style**: `icon-only` | `logo-light` | `logo-dark`.
  - Aspect ratio (reuse existing options).
  - Shared background: solid/gradient or a chosen image.
  - Scope: **every version** (default) | 66 localized only | top-N languages.
  - Run button; live progress (`n/total`, success/fail counts); Download buttons
    for each CSV (enabled when its data is ready).
- No business logic in the component — batch orchestration lives in `lib/`.

### 2. Version export pipeline (`src/lib/export/versionExport.ts`)

- Pure-ish orchestrator given injectable deps (fetchText, render, upload) so it
  is unit-testable without network/DOM.
- Concurrency pool (default 10). Per version: resolve language code → fetch text
  + localized reference → resolve logo (`resolveBulkLogo`) → render → upload →
  row.
- `resolveBulkLogo(code, chosenStyle)` (pure, in `src/lib/export/logo.ts`):
  if `resolveLogoFile(chosenStyle, code)` finds localized art → render with
  `{ languageId: code, logoStyle: chosenStyle }`; otherwise → render with
  `{ languageId: 'en', logoStyle: 'icon-only' }` (English app icon, no wordmark).
- Failure policy: retry once; on second failure record the row with a blank
  `air_cdn_link` and increment a failure counter (surfaced in the UI). Never
  aborts the whole batch on a single failure.
- Emits progress callbacks for the UI and appends completed ids to the
  checkpoint.

### 3. AIR integration (`src/lib/server/air.ts` + `src/app/api/air/upload/route.ts`)

- Port `client.py` to TypeScript, server-only:
  1. `POST {AIR_API_BASE}/v1/uploads` with `{ fileName, ext, size, mime, recordedAt, parentBoardId? }` → `{ uploadUrl, assetId, versionId }`.
  2. `PUT uploadUrl` with the image bytes and `Content-Type`.
  3. `POST /v1/assets/{assetId}/cdnLinks` with `{ versionId, ...cdnOptions }`,
     polling through 404s with capped backoff until ready → `{ url }`.
  - Fallback URL order mirrors `result_best_url`: cdn link → version preview →
    `https://air-prod.imgix.net/{versionId}.jpg`.
- Env (server-only): `AIR_API_KEY`, `AIR_WORKSPACE_ID`, optional
  `AIR_PARENT_BOARD_ID`, `AIR_API_BASE_URL` (default `https://api.air.inc`),
  optional `AIR_CDN_FORMAT` / `AIR_CDN_SIZE`.
- Route accepts a multipart image + filename, calls `uploadToAir`, returns
  `{ data: { cdnUrl } }` or `{ error }`. Returns 503 when AIR env is unset.

### 4. CSV builders (`src/lib/export/csv.ts`)

- `toCsv(rows, columns)` — RFC-4180 compliant: quote fields containing comma,
  quote, CR, or LF; escape embedded quotes by doubling. Verse text WILL contain
  these, so escaping is load-bearing.
- `buildVersionsCsv(rows)` → columns `version_id, reference, verse_text, air_cdn_link`.
- `buildGeoByCountryCsv(rows)` → columns
  `country, capital, image_urls, unsplash_credits` (image_urls/credits are the
  country's images joined with a stable delimiter, e.g. `" | "`).
- `buildGeoByLanguageCsv(rows)` → columns
  `language, language_name, country, image_urls, unsplash_credits` (each language
  maps to its country's images).
- Pure functions, unit-tested (including the escaping edge cases).

### 5. Geo backgrounds (`src/lib/export/geoBackgrounds.ts` + committed table)

- `src/lib/export/languageCountry.ts` — committed `language code → { country,
  capital }` mapping (generated for the covered set; long tail without a
  confident mapping is omitted from the geo CSV and logged, not guessed).
- Dedupe by country; for each country run curated Unsplash queries via the
  existing `/api/unsplash/search` route: templates like `"<country> landmark"`,
  `"<capital> skyline"`, plus seeded famous landmarks (e.g. Eiffel Tower for
  France).
- **Safety filter** (`isSafeGeoPhoto`, pure + unit-tested): reject any photo
  whose description/alt/tags match an exclusion blocklist — religion (church,
  mosque, temple, worship, cross, shrine, prayer…), politics/conflict (protest,
  war, election, politician…), and flags-bearing-text. Also pass
  `content_filter=high` to Unsplash. Prefer landmark/architecture/cityscape tags.
- Produce a single deduped `GeoResult` set (country → safe images), then derive
  both the by-country and by-language CSVs from it. Cap images per country
  (default 3) and `log()` the cap so coverage is not silently truncated.

### 6. Config (`src/config`)

- Server-only env additions for AIR (above). Unsplash key already exists
  (`UNSPLASH_ACCESS_KEY`). No `NEXT_PUBLIC_*` for any secret.

## Data flow / interfaces

```ts
interface VersionExportRow {
  version_id: string;
  reference: string;   // localized
  verse_text: string;  // localized
  air_cdn_link: string;
}

interface GeoResult {
  country: string;
  capital: string;
  images: { url: string; credit: string }[]; // deduped, safety-filtered, capped
  languages: { code: string; name: string }[]; // languages mapped to this country
}
// by-country CSV row: { country, capital, image_urls, unsplash_credits }
// by-language CSV row: { language, language_name, country, image_urls, unsplash_credits }

// server-only
async function uploadToAir(bytes: Uint8Array, opts: {
  fileName: string; mime: string;
}): Promise<{ cdnUrl: string }>;
```

## Error handling

- Per-version failures are isolated: retry once, then record a blank link and
  continue. UI shows the failure count.
- AIR env missing → `/api/air/upload` returns 503; the tab surfaces a clear
  "AIR not configured" message and disables Run.
- Unsplash errors per country are skipped (that country's row emits fewer/no
  images) and counted; the batch continues.
- Checkpoint in `localStorage` lets a re-run skip already-uploaded versions.

## Testing

- `csv.ts` — RFC-4180 escaping (commas, quotes, newlines in verse text), column
  ordering, empty rows.
- `logo.ts` — `resolveBulkLogo` returns the chosen style + code for a covered
  language, and English `icon-only` for an uncovered one.
- `versionExport.ts` — orchestration with injected fake deps: concurrency,
  retry-once-then-blank, checkpoint accumulation, progress callbacks.
- `geoBackgrounds.ts` — `isSafeGeoPhoto` accepts landmarks, rejects
  religious/political/flag-text photos; per-country dedupe; image cap; and the
  by-country / by-language CSVs derive consistently from one `GeoResult` set.
- `air.ts` — request/response shaping and the best-URL fallback order (mocked
  fetch; no network).

## Scale & performance

- ~3,700 verse-text fetches + renders + AIR uploads. At concurrency 10 and ~1–2s
  per AIR round-trip, expect roughly 10–20 minutes for a full run. Acceptable for
  a one-off marketing export; the checkpoint covers interruptions.
- Geo CSV queries are deduped by country (~tens–low-hundreds of countries), so
  Unsplash volume is small.

## Open items for spec review

- Geo CSV granularity: **resolved — emit both** a per-country CSV and a
  per-language CSV from the same deduped results (three CSVs total).
- Images-per-country cap (default 3).
- Whether to expose logo style per export or fix it (default: user-selectable).
