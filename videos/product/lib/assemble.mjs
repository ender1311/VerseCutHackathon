// Composite a captured app clip + narration + captions + branding into a
// finished marketing MP4. This ffmpeg build lacks drawtext/subtitles, so all
// text/graphics are rendered to PNG with ImageMagick (`magick`) and overlaid.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Aktiv Grotesk is the brand overlay font (static weights instanced from the
// Bible app's variable font). Bundled alongside the pipeline so renders match
// the studio's in-app assets without extra setup; PM_FONT* still override.
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
const FONT = process.env.PM_FONT || join(FONTS_DIR, 'AktivGrotesk-Regular.ttf');
const FONT_BOLD = process.env.PM_FONT_BOLD || join(FONTS_DIR, 'AktivGrotesk-Bold.ttf');
const BRAND = '#fe3745';

function magick(args) {
  execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

function makeBackground(out, w, h) {
  magick(['-size', `${w}x${h}`, 'gradient:#241016-#120407', out]);
}

function makeScrim(out, w, h, edge) {
  const grad = edge === 'top' ? 'gradient:white-black' : 'gradient:black-white';
  magick([
    '-size', `${w}x${h}`, 'xc:black',
    '(', '-size', `${w}x${h}`, grad, ')',
    '-alpha', 'off', '-compose', 'copy_opacity', '-composite', out,
  ]);
}

function makeCaption(out, text, w, fontPx) {
  magick([
    '-background', 'none', '-fill', 'white', '-font', FONT_BOLD,
    '-pointsize', String(fontPx), '-size', `${Math.round(w)}x`, '-gravity', 'center',
    `caption:${text}`,
    '(', '+clone', '-background', 'black', '-shadow', '90x6+0+2', ')',
    '+swap', '-background', 'none', '-layers', 'merge', '+repage', out,
  ]);
}

function makeTitle(out, title, subtitle, w) {
  const t = out.replace(/\.png$/, '-t.png');
  const s = out.replace(/\.png$/, '-s.png');
  magick(['-background', 'none', '-fill', 'white', '-font', FONT_BOLD, '-pointsize', '64',
    '-size', `${w}x`, '-gravity', 'west', `caption:${title}`, t]);
  magick(['-background', 'none', '-fill', '#ffd7db', '-font', FONT, '-pointsize', '34',
    '-size', `${w}x`, '-gravity', 'west', `caption:${subtitle}`, s]);
  magick(['-background', 'none', '-gravity', 'west', t, s, '-append', '+repage', out]);
}

function makeCta(out, text) {
  // White label text with padding (transparent), then a rounded brand pill
  // sized to the label, with the text composited on top.
  const label = out.replace(/\.png$/, '-l.png');
  magick(['-background', 'none', '-fill', 'white', '-font', FONT_BOLD, '-pointsize', '40',
    `label:${text}`, '-bordercolor', 'none', '-border', '44x28', label]);
  const dim = execFileSync('magick', ['identify', '-format', '%w %h', label]).toString().trim().split(' ');
  const lw = parseInt(dim[0], 10);
  const lh = parseInt(dim[1], 10);
  const r = Math.round(lh / 2);
  magick([
    '-size', `${lw}x${lh}`, 'xc:none',
    '-fill', BRAND, '-draw', `roundrectangle 0,0,${lw - 1},${lh - 1},${r},${r}`,
    label, '-gravity', 'center', '-composite', out,
  ]);
}

export function assemble(o) {
  const land = o.target.orientation === 'landscape';
  const W = land ? 1920 : 1080;
  const H = land ? 1080 : 1920;
  const work = o.workDir;
  mkdirSync(work, { recursive: true });

  const bg = join(work, 'bg.png');
  makeBackground(bg, W, H);

  // Pre-loop the app clip to cover the narration with a simple copy remux. The
  // complex filtergraph deadlocks on `-stream_loop` once the output exceeds the
  // clip length, so we never loop inside it.
  const clipDur = (() => {
    try {
      return parseFloat(
        execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', o.clip]).toString().trim(),
      );
    } catch {
      return 0;
    }
  })();
  let clipInput = o.clip;
  if (clipDur > 0 && clipDur < o.narration.total + 0.5) {
    const loops = Math.ceil((o.narration.total + 1) / clipDur);
    clipInput = join(work, 'clip-looped.mov');
    execFileSync('ffmpeg', ['-y', '-stream_loop', String(loops - 1), '-i', o.clip,
      '-c', 'copy', '-t', String(o.narration.total + 1), clipInput],
      { stdio: ['ignore', 'ignore', 'ignore'] });
  }

  // Bound every still-image input to the output length. Infinite `-loop 1`
  // inputs never EOF, which deadlocks the filtergraph/muxer once the graph has
  // many of them (it hangs at 0% CPU forever); giving each a finite `-t` lets
  // them all end cleanly.
  const dur = String(o.narration.total + 1);
  const inputs = ['-loop', '1', '-t', dur, '-i', bg, '-i', clipInput, '-i', o.narration.wav];
  let idx = 3;
  const musicIdx = o.music ? idx++ : null;
  if (o.music) inputs.push('-stream_loop', '-1', '-i', o.music);
  const register = (png) => {
    inputs.push('-loop', '1', '-t', dur, '-i', png);
    return idx++;
  };

  const filters = [];
  let base;

  if (land) {
    const sw = 506;
    const sh = 1096;
    const sx = 150;
    const sy = Math.round((H - sh) / 2);
    filters.push(`[0:v]scale=${W}:${H}[bgv]`);
    filters.push(`[1:v]scale=${sw}:${sh}:force_original_aspect_ratio=increase,crop=${sw}:${sh},setsar=1[app]`);
    filters.push(`[bgv][app]overlay=${sx}:${sy}[c0]`);
    base = 'c0';
  } else {
    filters.push(`[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[app]`);
    const top = join(work, 'top.png'); makeScrim(top, W, 520, 'top');
    const bot = join(work, 'bot.png'); makeScrim(bot, W, 640, 'bottom');
    const ti = register(top);
    const bi = register(bot);
    filters.push(`[app][${ti}:v]overlay=0:0[ct]`);
    filters.push(`[ct][${bi}:v]overlay=0:${H - 640}[c0]`);
    base = 'c0';
  }

  const titlePng = join(work, 'title.png');
  makeTitle(titlePng, o.branding.title, o.branding.subtitle, land ? 760 : 920);
  const tIdx = register(titlePng);
  const titlePos = land ? { x: 1180, y: 320 } : { x: 80, y: 130 };
  filters.push(`[${base}][${tIdx}:v]overlay=${titlePos.x}:${titlePos.y}:enable='gte(t,0.3)'[c1]`);
  base = 'c1';

  if (o.subtitles !== false) {
    o.narration.beats.forEach((b, i) => {
      const cap = join(work, `cap${i}.png`);
      makeCaption(cap, b.caption, land ? 700 : 960, land ? 40 : 46);
      const ci = register(cap);
      const capY = land ? 780 : H - 560;
      const capX = land ? '1180' : '(W-w)/2';
      filters.push(`[${base}][${ci}:v]overlay=${capX}:${capY}:enable='between(t,${b.start},${b.end})'[cap${i}]`);
      base = `cap${i}`;
    });
  }

  const ctaPng = join(work, 'cta.png');
  makeCta(ctaPng, o.branding.cta);
  const ctaIdx = register(ctaPng);
  const ctaY = land ? 880 : H - 380;
  const ctaStart = Math.max(0, o.narration.total - 3.5);
  filters.push(`[${base}][${ctaIdx}:v]overlay=(W-w)/2:${ctaY}:enable='gte(t,${ctaStart})'[v]`);

  let audioMap;
  if (o.music) {
    filters.push(`[${musicIdx}:a]volume=0.16[m]`);
    filters.push(`[2:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]`);
    audioMap = '[a]';
  } else {
    audioMap = '2:a';
  }

  const args = [
    '-y', ...inputs,
    // Serialize the filtergraph. With many `-loop 1` image inputs, the default
    // multi-threaded filtering deadlocks (hangs at 0% CPU) once the graph is
    // large; single-threaded filtering runs it deterministically to completion.
    '-filter_complex_threads', '1',
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', audioMap,
    // Hard-stop after exactly N output frames. `-t` alone hangs at finalize:
    // once output reaches the time limit it stops pulling frames, so the
    // infinite `-loop 1` image inputs never EOF and ffmpeg waits on them
    // forever. `-frames:v` terminates on the output frame count regardless.
    '-r', '30', '-frames:v', String(Math.round(o.narration.total * 30)),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-max_muxing_queue_size', '1024', '-movflags', '+faststart',
    o.outFile,
  ];
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  return o.outFile;
}
