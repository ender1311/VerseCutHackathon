#!/usr/bin/env node
// Product-marketing video generator. Designate a feature; it captures the real
// app in the simulator, generates localized voiceover + subtitles, and renders
// portrait + landscape × short + long MP4s.
//
//   node videos/product/bin/pm.mjs reading-plans --langs en,es
//   node videos/product/bin/pm.mjs reading-plans --no-capture   # reuse last clip
//
// Flags: --langs en,es | --formats portrait,landscape | --lengths short,long
//        --device <udid> | --no-capture
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDevice, bootIfNeeded, runFlow, recordWhile, sleep, openUrl } from '../lib/sim.mjs';
import { narrate } from '../lib/narrate.mjs';
import { assemble } from '../lib/assemble.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const feature = argv[0];
if (!feature || feature.startsWith('--')) {
  console.error('Usage: pm.mjs <feature> [--langs en,es] [--formats portrait,landscape] [--lengths short,long] [--subtitles on|off] [--voiceover on|off] [--device UDID] [--no-capture]');
  process.exit(1);
}
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
}
const langs = flag('langs', 'en').split(',');
const formats = flag('formats', 'portrait,landscape').split(',');
const lengths = flag('lengths', 'short,long').split(',');
const device = flag('device', '');
const noCapture = argv.includes('--no-capture');
const subtitles = flag('subtitles', 'on') !== 'off';
const voiceover = flag('voiceover', 'on') !== 'off';

const def = JSON.parse(readFileSync(join(ROOT, 'features', feature, 'feature.json'), 'utf8'));
const work = join(ROOT, 'work', feature);
const outDir = join(ROOT, 'out', feature);
mkdirSync(work, { recursive: true });
mkdirSync(outDir, { recursive: true });

const clip = join(work, 'capture.mov');

async function capture() {
  const udid = resolveDevice(device);
  bootIfNeeded(udid);
  console.log(`▶ capturing ${feature} on ${udid} …`);
  // Navigate to the starting screen first (not recorded), then record only the
  // on-screen journey so the clip is all app content (no launch/black frames).
  if (def.capture.prep) runFlow(udid, join(ROOT, def.capture.prep));
  await recordWhile(udid, clip, async () => {
    runFlow(udid, join(ROOT, def.capture.record || def.capture.flow));
  });
  console.log(`  ✓ clip → ${clip}`);
}

async function main() {
  if (!noCapture) await capture();
  if (!existsSync(clip)) throw new Error(`No capture clip at ${clip}; run without --no-capture first.`);

  const music = def.music ? join(ROOT, def.music) : null;
  const results = [];

  for (const length of lengths) {
    for (const lang of langs) {
      const beats = def.scripts?.[length]?.[lang];
      if (!beats) {
        console.warn(`  ! no ${length}/${lang} script; skipping`);
        continue;
      }
      const voice = def.voices?.[lang] || 'af_heart';
      console.log(`▶ narrating ${length}/${lang} (${voice}) voiceover=${voiceover} subtitles=${subtitles} …`);
      const narration = narrate({ beats, voice, voiceover, outDir: join(work, `${length}-${lang}`) });

      for (const orientation of formats) {
        const outFile = join(outDir, `${feature}-${length}-${lang}-${orientation}.mp4`);
        console.log(`▶ assembling ${length}/${lang}/${orientation} → ${outFile}`);
        assemble({
          clip,
          narration,
          music,
          subtitles,
          target: { orientation },
          branding: { title: def.title, subtitle: def.subtitle, cta: def.cta },
          outFile,
          workDir: join(work, `asm-${length}-${lang}-${orientation}`),
        });
        results.push(outFile);
      }
    }
  }

  console.log(`\n✓ ${results.length} videos in ${outDir}:`);
  for (const r of results) console.log('  ' + r.replace(ROOT + '/', ''));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
