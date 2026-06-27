# Product Marketing videos (offline HyperFrames)

Premium, narrated product-marketing films rendered **offline** with
[HyperFrames](https://hyperframes.heygen.com) (HeyGen's HTML+GSAP video CLI) —
the same pipeline as `../nexus/videos`. Voiceover uses **Kokoro** (local, free,
**no API key**); subtitles + scene timing are derived from the narration; ambient
music can be added as an extra `<audio>` track.

This is a CLI build step, not part of the Next.js app — it writes MP4 files you
then upload (e.g. to the asset library / Vercel Blob).

## Requirements

- Node 18+ and `ffmpeg`/`ffprobe` on PATH
- Network access (downloads `hyperframes` + the Kokoro voice model on first run)

## Generate a verse film

```bash
# 1. Build a composition from a verse (fetches text via the internal reader API)
node videos/lib/from-verse.mjs \
  --version 111 --ref JHN.3.16-17 --reference "John 3:16-17" \
  --cta "Download the Bible App!" --out videos/verse-promo

# 2. Build narration + timings, then render — one MP4 per voice
bash videos/lib/make.sh videos/verse-promo verse heart:af_heart michael:am_michael
#   → videos/verse-promo/out/verse__heart.mp4, verse__michael.mp4
```

`make.sh` runs `lib/build.mjs` (per-beat Kokoro TTS → padded concat →
`narration.wav` + `timings.js`) then `npx hyperframes render`.

## Localized voiceover

Pass Kokoro voices for the target language (prefix → language): `af_/am_`
US English, `bf_/bm_` British, `ef_/em_` Spanish, `jf_/jm_` Japanese, `zf_/zm_`
Mandarin. Generate the composition in that language's version, then render with a
matching voice, e.g.:

```bash
node videos/lib/from-verse.mjs --version 128 --ref JHN.3.16-17 --reference "Juan 3:16-17" \
  --cta "¡Descarga la App de la Biblia!" --out videos/verse-promo-es
bash videos/lib/make.sh videos/verse-promo-es verse-es dora:ef_dora
```

## Layout

`from-verse.mjs` writes a 1080×1920 composition: scene 1 reference hook → scene 2
verse (teal Fraunces serif) → scene 3 CTA + Bible App lockup, with synced
subtitles. Edit the template in `from-verse.mjs` (or the generated `index.html`)
to adjust branding, then re-render.

## Notes

- `out/`, `narration.wav`, `timings.js`, and `.tts-tmp/` are build artifacts (gitignored).
- Swap the placeholder ✝ mark for the real Bible App lockup by dropping the asset
  into the composition and referencing it from `index.html`.
