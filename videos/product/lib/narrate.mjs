// Localized narration + subtitles via Kokoro TTS (the `hyperframes tts` CLI —
// local, free, no API key). Given an ordered list of beats and a voice, writes
// narration.wav, subtitles.srt, and returns per-beat timings.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const round = (n) => Math.round(n * 1000) / 1000;

function ffprobeDuration(file) {
  return parseFloat(
    execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ]).toString().trim(),
  );
}

function ttsWithRetry(text, voice, out, attempts = 4) {
  for (let a = 1; a <= attempts; a++) {
    try {
      execFileSync('npx', ['-y', 'hyperframes@0.6.112', 'tts', text, '--voice', voice, '--output', out], {
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      return;
    } catch (e) {
      if (a === attempts) throw e;
    }
  }
}

function srtTime(t) {
  const ms = Math.round(t * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const milli = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
}

/**
 * @param {{ beats: {text:string, caption?:string}[], voice:string, outDir:string, gap?:number, lead?:number, tail?:number }} opts
 * @returns {{ wav:string, srt:string, total:number, beats:{start:number,end:number,caption:string}[] }}
 */
export function narrate({ beats, voice, outDir, gap = 0.32, lead = 0.4, tail = 0.8 }) {
  mkdirSync(outDir, { recursive: true });
  const tmp = join(outDir, '.tts');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  const padded = [];
  const durations = [];
  beats.forEach((b, i) => {
    const raw = join(tmp, `s${i}.wav`);
    ttsWithRetry(b.text, voice, raw);
    durations.push(ffprobeDuration(raw));
    const pad = join(tmp, `p${i}.wav`);
    execFileSync('ffmpeg', ['-y', '-i', raw, '-af', `apad=pad_dur=${gap}`, '-ar', '24000', '-ac', '1', pad], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    padded.push(pad);
  });

  // A short lead of silence so the voice doesn't start on frame 0.
  const leadFile = join(tmp, 'lead.wav');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`, '-t', String(lead), leadFile], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  const listFile = join(tmp, 'list.txt');
  writeFileSync(listFile, [leadFile, ...padded].map((p) => `file '${p}'`).join('\n'));
  const wav = join(outDir, 'narration.wav');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', wav], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  // Beat timings + SRT.
  let t = lead;
  const timings = beats.map((b, i) => {
    const start = t;
    const end = start + durations[i];
    t = end + gap;
    return { start: round(start), end: round(end), caption: b.caption ?? b.text };
  });
  const total = round(t - gap + tail);

  const srt = join(outDir, 'subtitles.srt');
  writeFileSync(
    srt,
    timings
      .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.caption}\n`)
      .join('\n'),
  );

  rmSync(tmp, { recursive: true, force: true });
  return { wav, srt, total, beats: timings };
}
