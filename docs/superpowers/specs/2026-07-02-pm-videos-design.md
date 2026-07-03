# Product-Marketing Videos — Design (toggles + feature batch)

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## Goal

Produce marketing videos for the Bible App's top features — **VOTD, Guided
Scripture, Guided Prayer, Audio, Discover** — in portrait + landscape × short +
long, English first, with **toggleable subtitles and voiceover** and a **warm
female** voice. Videos are built locally (Maestro capture in the iOS Simulator +
render) and published to the product-marketing library.

## Current pipeline (recap)

`videos/product/` already renders portrait+landscape × short+long × per-language,
with Kokoro TTS **voiceover** and burned-in **subtitles/captions** generated
together. A feature = `feature.json` (title/CTA/`voices`/short+long `scripts`
with `text`+`caption` beats) + Maestro capture flows (`shots/*.yaml`) that drive
the real app (`tv.lifechurch.bible`). Default voices are warm female
(`af_heart` en, `ef_dora` es, `pf_dora` pt, `ff_siwis` fr). Build:
`pm.mjs <feature> --langs --formats --lengths`; the local-only `/api/pm/*` routes
+ `ProductBuilder` UI drive it; outputs publish to `ProductVideo` via
`/api/pm/publish`.

## Slices

- **Slice 1 — toggles (deterministic, PR):** subtitle on/off + voiceover on/off.
- **Slice 2 — VOTD end-to-end (local):** author + record + render VOTD as the
  proven template; checkpoint for review.
- **Slice 3 — replicate:** Guided Scripture, Guided Prayer, Audio, Discover.

## Slice 1 — toggles

- `pm.mjs`: add `--subtitles on|off` (default on) and `--voiceover on|off`
  (default on) flags.
  - voiceover off → skip TTS + narration audio track (silent video; keep music
    if a feature defines it).
  - subtitles off → skip caption burn-in.
  - When voiceover is off, beat *timing* falls back to a fixed per-beat duration
    (since there's no narration audio to time against) so pacing still works.
- `narrate.mjs` / `assemble.mjs`: honor the flags (skip TTS / skip caption
  compositing).
- `src/lib/server/pm.ts` `BuildRequest`: add `subtitles: boolean`,
  `voiceover: boolean`; `startBuild` passes them as CLI flags.
- `POST /api/pm/build` route: accept + forward the two booleans (default true).
- `ProductBuilder` UI: **Subtitles** and **Voiceover** checkboxes (default on)
  wired into the build request.
- Voice: warm female is already the default per language — no change needed;
  documented.
- Pure logic (flag parsing / beat-duration fallback) unit-tested where
  extractable.

## Slice 2 — VOTD (local, iterative)

- `videos/product/features/votd/feature.json` — title "Verse of the Day", CTA,
  `voices` (female warm), English short + long `scripts` (beats: text +
  caption). (es/pt/fr later.)
- `videos/product/features/votd/shots/prep.yaml` + `record.yaml` — Maestro flow
  that opens the app to the Today/VOTD screen and records the journey (verse of
  the day → image → share, all viewable without an account where possible),
  modeled on `reading-plans/shots/*.yaml`.
- Boot the Simulator, run `pm.mjs votd --langs en --formats portrait,landscape
  --lengths short,long`; iterate the flow against the live app until the capture
  is clean; render the 4 MP4s.
- Publish via the builder's "Publish to library".
- **Checkpoint:** review VOTD output before Slice 3.

## Slice 3 — replicate

Repeat Slice 2 for Guided Scripture, Guided Prayer, Audio, Discover (English;
4 MP4s each). Child components deferred to a later batch.

## Constraints / caveats

- Rendering is **local-only** (`pmEnabled()` = not prod/Vercel); needs the
  Simulator + `tv.lifechurch.bible` installed + Maestro (all present; reading-plans
  has rendered before).
- Maestro flow authoring is iterative — depends on the app's current on-screen
  labels; expect tuning.
- PM captions use ImageMagick with a local font file — to render Aktiv Grotesk in
  videos, set `PM_FONT`/`PM_FONT_BOLD` to a local Aktiv Grotesk `.otf`
  (env-overridable; default Arial).

## Testing / verification

- Slice 1: unit-test extractable pure logic; run a build with each toggle combo
  (needs local sim) — verify a silent video / a no-caption video.
- Slice 2/3: visually review rendered MP4s (manual).
- `npm run check` green each slice.

## Decisions (confirmed)

- Toggles: subtitle on/off, voiceover on/off (default both on).
- Warm female voice (already the per-language default).
- 5 top features; **English first**; portrait+landscape × short+long.
- Build in slices; VOTD first as the template; record + render on the local Mac.
