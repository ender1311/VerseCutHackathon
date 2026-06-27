#!/usr/bin/env node
// Data-driven narration builder for HyperFrames videos (mirrors nexus/wayfinder).
// Per-beat Kokoro TTS (no API key) → padded concat → exact, voice-independent
// timings consumed by the composition's index.html.
//
// Usage: node ../lib/build.mjs <projectDir> <voice> [gapSeconds]
//   reads  <projectDir>/beats.json  = [{ "text": "...", "scene": 1, "caption"?: "..." }, ...]
//   writes <projectDir>/narration.wav  and  <projectDir>/timings.js
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [, , projectDirArg, voiceArg, gapArg] = process.argv;
if (!projectDirArg || !voiceArg) {
  console.error('Usage: node build.mjs <projectDir> <voice> [gapSeconds]');
  process.exit(1);
}
const projectDir = resolve(projectDirArg);
const voice = voiceArg;
const GAP = gapArg ? parseFloat(gapArg) : 0.28;
const LEAD = 0.45;
const TAIL = 0.8;

const beats = JSON.parse(readFileSync(join(projectDir, 'beats.json'), 'utf8'));
const tmp = join(projectDir, '.tts-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const round = (n) => Math.round(n * 1000) / 1000;
const ffprobeDuration = (file) =>
  parseFloat(
    execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ]).toString().trim(),
  );

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function ttsWithRetry(text, raw, attempts = 4) {
  for (let a = 1; a <= attempts; a++) {
    try {
      execFileSync('npx', ['-y', 'hyperframes@0.6.112', 'tts', text, '--voice', voice, '--output', raw], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      return;
    } catch (e) {
      if (a === attempts) throw e;
      process.stderr.write(`\n  tts beat retry ${a}/${attempts - 1}...\n`);
      sleepSync(2000);
    }
  }
}

const padded = [];
const durations = [];
beats.forEach((b, i) => {
  const raw = join(tmp, `s${i}.wav`);
  ttsWithRetry(b.text, raw);
  durations.push(ffprobeDuration(raw));
  const pad = join(tmp, `p${i}.wav`);
  execFileSync('ffmpeg', ['-y', '-i', raw, '-af', `apad=pad_dur=${GAP}`, '-ar', '24000', '-ac', '1', pad], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  padded.push(pad);
  process.stderr.write(`  beat ${i + 1}/${beats.length}\r`);
});
process.stderr.write('\n');

const listFile = join(tmp, 'list.txt');
writeFileSync(listFile, padded.map((p) => `file '${p}'`).join('\n'));
const narration = join(projectDir, 'narration.wav');
execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', narration], {
  stdio: ['ignore', 'ignore', 'ignore'],
});

let t = 0;
const beatTimings = beats.map((b, i) => {
  const start = t;
  const end = start + durations[i];
  t = end + GAP;
  return { text: b.caption ?? b.text, scene: b.scene, start: round(start), end: round(end) };
});
const total = round(t - GAP + TAIL);

const sceneIds = [...new Set(beats.map((b) => b.scene))].sort((a, b) => a - b);
const scenes = {};
let prevId = null;
sceneIds.forEach((id, idx) => {
  const first = beatTimings.find((bt) => bt.scene === id);
  const fadeStart = idx === 0 ? 0 : Math.max(0, round(first.start - LEAD));
  scenes[id] = { fadeStart, hideAt: null };
  if (prevId !== null) scenes[prevId].hideAt = round(fadeStart + 0.6);
  prevId = id;
});
if (prevId !== null) scenes[prevId].hideAt = null;

const audioDuration = round(ffprobeDuration(narration));
writeFileSync(
  join(projectDir, 'timings.js'),
  'window.__VIDEO_TIMINGS = ' +
    JSON.stringify({ voice, total, audioDuration, scenes, beats: beatTimings }, null, 2) +
    ';\n',
);

const indexPath = join(projectDir, 'index.html');
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8');
  html = html.replace(/(<div id="root"[^>]*?data-duration=")[^"]*(")/, `$1${total}$2`);
  html = html.replace(/(<audio id="vo"[^>]*?data-duration=")[^"]*(")/, `$1${audioDuration}$2`);
  writeFileSync(indexPath, html);
}

rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${voice}: ${beats.length} beats · narration ${audioDuration}s · total ${total}s`);
