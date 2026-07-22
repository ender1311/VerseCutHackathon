import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { config, type AspectRatio } from '../config';
import { composeFrame, ensureFontsReady, type Background } from './compositor';
import { resolveGradient, gradientFromHex } from './gradients';
import type { Passage } from './bible';
import { BIBLE_APP_ASSETS, type LogoStyle } from './iconCatalog';
import { resolveLogoFile } from './logoAssets';
import { loadVerseFont } from './fonts';

export interface RenderInput {
  passage: Passage;
  aspect: AspectRatio;
  dimensions: { width: number; height: number };
  imageFile: File | null;
  videoFile: File | null;
  /** Remote background image URL (e.g. a shared upload in Blob). */
  imageUrl?: string | null;
  /** Remote background video URL from the library or a shared upload. */
  videoUrl?: string | null;
  mimeType?: 'image/png' | 'image/jpeg';
  /** Selected language id; used to pick a localized corner logo. */
  languageId?: string;
  /** Logo style for the corner mark. */
  logoStyle?: LogoStyle;
  /** Layout template. */
  template?: 'classic' | 'promo';
  /** Call-to-action line for the promo template. */
  cta?: string | null;
  /** Video length in seconds (defaults to config). */
  durationSec?: number;
  /** Ambient/background music track to mix into the video audio. */
  musicFile?: File | null;
  /** Music gain 0..1 (defaults applied in the mixer). */
  musicVolume?: number;
  /** Voiceover narration audio (from in-browser Kokoro TTS) to mix in. */
  narrationBlob?: Blob | null;
  /** Background gradient preset id (used when no image/video background). */
  gradientId?: string | null;
  /** Custom background color (hex). Takes precedence over gradientId. */
  gradientHex?: string | null;
}

/** The promo template uses the horizontal light lockup; classic uses the chosen style. */
function effectiveLogoStyle(input: RenderInput): LogoStyle {
  if (input.template === 'promo') return 'logo-light';
  return input.logoStyle ?? config.brand.defaultLogoStyle;
}

/** Resolve the corner-logo path, optionally localized to the language + style. */
function resolveLogoPath(languageId?: string, style?: LogoStyle): string {
  if (!config.brand.logoByLanguage || !languageId) return config.brand.logoPath;
  const s: LogoStyle = style ?? config.brand.defaultLogoStyle;
  const file =
    resolveLogoFile(s, languageId) ??
    BIBLE_APP_ASSETS[s]?.['en'] ??
    BIBLE_APP_ASSETS['icon-only']['en'];
  return file ? `${config.brand.logoBaseDir}/${s}/${file}` : config.brand.logoPath;
}

export interface RenderedAsset {
  blob: Blob;
  url: string;
  ext: string;
  kind: 'image' | 'video';
  /** Set when a video could not be encoded to MP4 and fell back to WebM. */
  note?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function loadVideoFromSrc(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Failed to load background video'));
    v.src = src;
  });
}

async function buildBackground(
  input: RenderInput,
): Promise<{ background: Background; cleanup: () => void }> {
  if (input.imageFile) {
    const url = URL.createObjectURL(input.imageFile);
    const image = await loadImage(url);
    return { background: { type: 'image', image }, cleanup: () => URL.revokeObjectURL(url) };
  }
  if (input.imageUrl) {
    const image = await loadImage(input.imageUrl);
    return { background: { type: 'image', image }, cleanup: () => {} };
  }
  if (input.videoFile) {
    const url = URL.createObjectURL(input.videoFile);
    const video = await loadVideoFromSrc(url);
    return { background: { type: 'video', video }, cleanup: () => URL.revokeObjectURL(url) };
  }
  if (input.videoUrl) {
    const video = await loadVideoFromSrc(input.videoUrl);
    return { background: { type: 'video', video }, cleanup: () => {} };
  }
  return {
    background: {
      type: 'gradient',
      preset: input.gradientHex ? gradientFromHex(input.gradientHex) : resolveGradient(input.gradientId),
    },
    cleanup: () => {},
  };
}

// ---------------------------------------------------------------------------
// Static image
// ---------------------------------------------------------------------------
export async function renderImage(input: RenderInput): Promise<RenderedAsset> {
  await ensureFontsReady();
  const verseFont = await loadVerseFont(input.passage.text, input.languageId);
  const logo = await loadImage(
    resolveLogoPath(input.languageId, effectiveLogoStyle(input)),
  ).catch(() => null);
  const { background, cleanup } = await buildBackground(input);

  const canvas = document.createElement('canvas');
  canvas.width = input.dimensions.width;
  canvas.height = input.dimensions.height;
  const ctx = canvas.getContext('2d')!;

  const mime = input.mimeType ?? 'image/png';
  let blob: Blob;
  // Ensure the background object URL is revoked even if compose/export throws.
  try {
    composeFrame(ctx, {
      width: canvas.width,
      height: canvas.height,
      verseText: input.passage.text,
      reference: input.passage.reference,
      versionAbbreviation: input.passage.versionAbbreviation,
      background,
      logo,
      verseFont,
      template: input.template,
      cta: input.cta ?? undefined,
      // Light lockups keep their transparent background (no white plate).
      logoPlate: false,
      t: 1,
    });

    blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
        mime,
        0.95,
      ),
    );
  } finally {
    cleanup();
  }

  return {
    blob,
    url: URL.createObjectURL(blob),
    ext: mime === 'image/jpeg' ? 'jpg' : 'png',
    kind: 'image',
  };
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------
/**
 * Best available recording container. Prefer MP4/H.264 (Chrome 105+, Safari) so
 * we can deliver MP4 with zero transcode; fall back to WebM otherwise.
 */
function pickRecordingMime(): { mime: string; ext: string } {
  // Prefer containers/codecs that carry an audio track too.
  const mp4 = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
  ];
  for (const m of mp4) {
    if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'mp4' };
  }
  const webm = [
    'video/webm;codecs="vp8,opus"',
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of webm) {
    if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'webm' };
  }
  return { mime: 'video/webm', ext: 'webm' };
}

/**
 * Build one capturable audio track via Web Audio, mixing (a) the background
 * video's own audio and (b) an ambient music track, into a single stream that's
 * recorded with the canvas. Routes only to the stream destination (no speakers).
 * Returns null if there's nothing to mix.
 */
function buildAudioMix(opts: {
  video?: HTMLVideoElement | null;
  musicUrl?: string | null;
  musicVolume?: number;
  narrationUrl?: string | null;
}): { track: MediaStreamTrack; start: () => void; cleanup: () => void } | null {
  const { video, musicUrl, narrationUrl } = opts;
  if (!video && !musicUrl && !narrationUrl) return null;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    const disconnects: Array<() => void> = [];
    const playables: HTMLAudioElement[] = [];

    if (video) {
      video.muted = false;
      video.volume = 1;
      const s = ctx.createMediaElementSource(video);
      s.connect(dest);
      disconnects.push(() => s.disconnect());
    }

    if (narrationUrl) {
      const el = new Audio();
      el.src = narrationUrl;
      el.crossOrigin = 'anonymous';
      const s = ctx.createMediaElementSource(el);
      s.connect(dest); // voiceover at full volume
      disconnects.push(() => s.disconnect());
      playables.push(el);
    }

    if (musicUrl) {
      const el = new Audio();
      el.src = musicUrl;
      el.loop = true;
      el.crossOrigin = 'anonymous';
      const s = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      // Duck music further when a voiceover is present.
      gain.gain.value = opts.musicVolume ?? (narrationUrl ? 0.14 : video ? 0.35 : 0.8);
      s.connect(gain).connect(dest);
      disconnects.push(() => {
        s.disconnect();
        gain.disconnect();
      });
      playables.push(el);
    }

    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      ctx.close();
      return null;
    }
    return {
      track,
      start: () => {
        for (const el of playables) {
          el.currentTime = 0;
          void el.play().catch(() => {});
        }
      },
      cleanup: () => {
        try {
          playables.forEach((el) => el.pause());
          disconnects.forEach((d) => d());
          ctx.close();
        } catch {
          /* noop */
        }
      },
    };
  } catch {
    return null;
  }
}

/** Record the animated canvas to a Blob via MediaRecorder. */
async function captureCanvas(
  input: RenderInput,
  background: Background,
  logo: HTMLImageElement | null,
  mimeType: string,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const { width, height } = input.dimensions;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const verseFont = await loadVerseFont(input.passage.text, input.languageId);

  const fps = config.output.videoFps;
  const durationMs = (input.durationSec ?? config.output.videoDurationSec) * 1000;
  const stream = canvas.captureStream(fps);

  // Mix background-video audio and/or ambient music into one captured track.
  const musicUrl = input.musicFile ? URL.createObjectURL(input.musicFile) : null;
  const narrationUrl = input.narrationBlob ? URL.createObjectURL(input.narrationBlob) : null;
  if (background.type === 'video') background.video.currentTime = 0;

  let mix: ReturnType<typeof buildAudioMix> = null;
  let recorder: MediaRecorder | null = null;
  // Guarantee teardown (AudioContext, background video, object URLs, recorder)
  // even if MediaRecorder construction, playback, or a frame draw throws.
  try {
    mix = buildAudioMix({
      video: background.type === 'video' ? background.video : null,
      musicUrl,
      musicVolume: input.musicVolume,
      narrationUrl,
    });
    if (mix) stream.addTrack(mix.track);
    if (background.type === 'video') await background.video.play().catch(() => {});

    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: 128_000,
    });
    const rec = recorder;
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const done = new Promise<Blob>((resolve) => {
      // Resolve on error too, so a recorder failure can't hang `await done`.
      rec.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      rec.onerror = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    rec.start();
    mix?.start();
    const start = performance.now();

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        try {
          const elapsed = performance.now() - start;
          const t = Math.min(1, elapsed / durationMs);
          composeFrame(ctx, {
            width,
            height,
            verseText: input.passage.text,
            reference: input.passage.reference,
            versionAbbreviation: input.passage.versionAbbreviation,
            background,
            logo,
            verseFont,
            template: input.template,
            cta: input.cta ?? undefined,
            // Light lockups keep their transparent background (no white plate).
      logoPlate: false,
            t,
          });
          onProgress(t);
          if (elapsed >= durationMs) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        } catch (e) {
          reject(e);
        }
      };
      requestAnimationFrame(tick);
    });

    rec.stop();
    return await done;
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (background.type === 'video') background.video.pause();
    mix?.cleanup();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
  }
}

let ffmpegSingleton: FFmpeg | null = null;
// The singleton's listeners are attached once; these hold the current render's
// callbacks so we don't stack a new listener (closing over a stale cb) on every
// transcode. See getFFmpeg / renderVideo.
let currentOnLog: ((m: string) => void) | undefined;
let currentOnProgress: ((fraction: number) => void) | undefined;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => currentOnLog?.(message));
  ffmpeg.on('progress', ({ progress }) => currentOnProgress?.(Math.min(1, progress)));

  // Use the multi-threaded core when the page is cross-origin isolated
  // (SharedArrayBuffer available) — it encodes H.264 far faster. Falls back
  // to the single-threaded core otherwise.
  const mt = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  const pkg = mt ? '@ffmpeg/core-mt' : '@ffmpeg/core';
  const baseURL = `https://cdn.jsdelivr.net/npm/${pkg}@0.12.10/dist/umd`;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    ...(mt
      ? { workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript') }
      : {}),
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

export interface VideoRenderCallbacks {
  onCapture?: (fraction: number) => void;
  onEncode?: (fraction: number) => void;
  onLog?: (message: string) => void;
}

export async function renderVideo(
  input: RenderInput,
  cb: VideoRenderCallbacks = {},
): Promise<RenderedAsset> {
  await ensureFontsReady();
  const logo = await loadImage(
    resolveLogoPath(input.languageId, effectiveLogoStyle(input)),
  ).catch(
    () => null,
  );
  const { background, cleanup } = await buildBackground(input);

  const recording = pickRecordingMime();
  let captured: Blob;
  // Revoke the background object URL even if capture throws.
  try {
    captured = await captureCanvas(
      input,
      background,
      logo,
      recording.mime,
      cb.onCapture ?? (() => {}),
    );
  } finally {
    cleanup();
  }

  // Fast path: the browser recorded H.264/MP4 directly — no transcode needed.
  if (recording.ext === 'mp4') {
    cb.onEncode?.(1);
    return {
      blob: captured,
      url: URL.createObjectURL(captured),
      ext: 'mp4',
      kind: 'video',
    };
  }

  // Fallback (e.g. Firefox records WebM): transcode WebM -> MP4 via ffmpeg.wasm.
  try {
    const ffmpeg = await getFFmpeg();
    currentOnLog = cb.onLog;
    currentOnProgress = (f) => cb.onEncode?.(f);
    await ffmpeg.writeFile('in.webm', await fetchFile(captured));
    const code = await ffmpeg.exec([
      '-i', 'in.webm',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-crf', '24',
      '-threads', '0',
      '-movflags', '+faststart',
      'out.mp4',
    ]);
    if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
    const data = await ffmpeg.readFile('out.mp4');
    await ffmpeg.deleteFile('in.webm').catch(() => {});
    await ffmpeg.deleteFile('out.mp4').catch(() => {});
    const bytes = new Uint8Array(data as Uint8Array);
    const blob = new Blob([bytes], { type: 'video/mp4' });
    return { blob, url: URL.createObjectURL(blob), ext: 'mp4', kind: 'video' };
  } catch (err) {
    // Fallback: deliver the WebM directly. A server-side render step (see
    // README) is the recommended path for guaranteed MP4 + audio at scale.
    cb.onLog?.(`MP4 encode unavailable, delivering WebM: ${String(err)}`);
    return {
      blob: captured,
      url: URL.createObjectURL(captured),
      ext: 'webm',
      kind: 'video',
      note: 'MP4 encoder unavailable in this browser session — delivered WebM. See README for the backend render option.',
    };
  } finally {
    currentOnLog = undefined;
    currentOnProgress = undefined;
  }
}
