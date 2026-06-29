# Product Marketing videos (real-app capture pipeline)

Generate product-marketing videos from **actual renderings of the YouVersion
Bible iOS app**, captured live in the iOS Simulator. Designate a feature; the
pipeline produces the full matrix — **portrait (9:16) + landscape (16:9)**,
**short (~10s) + long (>30s)** — with **voiceover (Kokoro TTS)**, **localized
languages**, and **burned-in subtitles**. Everything runs locally on a Mac.

## Requirements (all local)

- Xcode iOS Simulator with the **Bible app installed** (bundle `tv.lifechurch.bible`).
- **Maestro** (`~/.maestro/bin/maestro`) + a JDK (Homebrew `openjdk`).
- **ffmpeg/ffprobe** and **ImageMagick** (`magick`) on PATH.
- Node 18+ and network (first run downloads the Kokoro voice model via `hyperframes`).

## Generate

```bash
# Designate a feature → all variants (portrait+landscape × short+long × langs)
node videos/product/bin/pm.mjs reading-plans --langs en,es

# Reuse the last capture (skip the simulator), just re-render
node videos/product/bin/pm.mjs reading-plans --no-capture

# Flags: --langs en,es | --formats portrait,landscape | --lengths short,long
#        --device <udid> | --no-capture
```

Output: `videos/product/out/<feature>/<feature>-<length>-<lang>-<orientation>.mp4`.

## How it works

1. **Capture** (`lib/sim.mjs` + `features/<f>/shots/`): a *prep* flow navigates
   the app to the start screen (not recorded), then `xcrun simctl io recordVideo`
   records the *record* flow's on-screen journey.
2. **Narrate** (`lib/narrate.mjs`): per-beat Kokoro TTS → `narration.wav` +
   `subtitles.srt` + timings, per language. Short (~10s) and long (>30s) scripts
   live in `feature.json`.
3. **Assemble** (`lib/assemble.mjs`): ImageMagick renders title/captions/CTA/
   scrims to PNG (this ffmpeg has no drawtext/subtitles), ffmpeg composites the
   app footage + overlays + VO + ducked music into each orientation.

## Add a feature

Create `features/<id>/feature.json` (title, subtitle, cta, voices, short/long
scripts per language) + `shots/prep.yaml` and `shots/record.yaml` (Maestro flows
using deep links like `youversion://reading-plans/<id>`, `youversion://today`,
`youversion://guides/<id>`, `youversion://stories/<id>`).

## Upload approved videos to production

Review the MP4s; upload only the ones you like (writes to PROD Blob + DB):

```bash
node videos/product/bin/upload.mjs videos/product/out/reading-plans/reading-plans-short-en-portrait.mp4
```

## Auth note

`start a plan` / `finish a plan day` require a logged-in account. The sim app
runs on **staging**, which needs a confirmed-email account. Credentials live in
`videos/product/.pm-creds.env` (untracked). Logged-out journeys (browse → Sample
→ devotional, VOTD, Reader) need no account and are the default for v1.
