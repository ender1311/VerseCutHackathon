import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { config, type AspectRatio } from '../config';
import { composeFrame, ensureFontsReady, type Background } from './compositor';
import type { Passage } from './bible';
import { BIBLE_APP_ASSETS, type LogoStyle } from './iconCatalog';
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
  /** Video length in seconds (defaults to config). */
  durationSec?: number;
}

/** Resolve the corner-logo path, optionally localized to the language + style. */
function resolveLogoPath(languageId?: string, style?: LogoStyle): string {
  if (!config.brand.logoByLanguage || !languageId) return config.brand.logoPath;
  const s: LogoStyle = style ?? config.brand.defaultLogoStyle;
  const cat = BIBLE_APP_ASSETS[s] ?? BIBLE_APP_ASSETS['icon-only'];
  const file = cat[languageId] || cat[languageId.split('-')[0]] || cat['en'];
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
  return { background: { type: 'gradient' }, cleanup: () => {} };
}

// ---------------------------------------------------------------------------
// Static image
// ---------------------------------------------------------------------------
export async function renderImage(input: RenderInput): Promise<RenderedAsset> {
  await ensureFontsReady();
  const verseFont = await loadVerseFont(input.passage.text, input.languageId);
  const logo = await loadImage(resolveLogoPath(input.languageId, input.logoStyle)).catch(
    () => null,
  );
  const { background, cleanup } = await buildBackground(input);

  const canvas = document.createElement('canvas');
  canvas.width = input.dimensions.width;
  canvas.height = input.dimensions.height;
  const ctx = canvas.getContext('2d')!;

  composeFrame(ctx, {
    width: canvas.width,
    height: canvas.height,
    verseText: input.passage.text,
    reference: input.passage.reference,
    versionAbbreviation: input.passage.versionAbbreviation,
    background,
    logo,
    verseFont,
    logoPlate: input.logoStyle === 'logo-light',
    t: 1,
  });

  const mime = input.mimeType ?? 'image/png';
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      mime,
      0.95,
    ),
  );
  cleanup();

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
 * Tap a video element's audio into a capturable MediaStream track via Web Audio.
 * Routes only to the stream destination (no speakers). Returns null if the
 * background has no audio or the graph can't be built.
 */
function tapVideoAudio(
  video: HTMLVideoElement,
): { track: MediaStreamTrack; cleanup: () => void } | null {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    video.muted = false;
    video.volume = 1;
    const ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest); // capture only — intentionally not connected to ctx.destination
    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      ctx.close();
      return null;
    }
    return {
      track,
      cleanup: () => {
        try {
          source.disconnect();
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

  // Mix in the background video's audio track when present.
  let audioCleanup: (() => void) | null = null;
  if (background.type === 'video') {
    background.video.currentTime = 0;
    const audio = tapVideoAudio(background.video);
    if (audio) {
      stream.addTrack(audio.track);
      audioCleanup = audio.cleanup;
    }
    await background.video.play().catch(() => {});
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
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
        logoPlate: input.logoStyle === 'logo-light',
        t,
      });
      onProgress(t);
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  if (background.type === 'video') background.video.pause();
  const blob = await done;
  audioCleanup?.();
  return blob;
}

let ffmpegSingleton: FFmpeg | null = null;
async function getFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));

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
  const logo = await loadImage(resolveLogoPath(input.languageId, input.logoStyle)).catch(
    () => null,
  );
  const { background, cleanup } = await buildBackground(input);

  const recording = pickRecordingMime();
  const captured = await captureCanvas(
    input,
    background,
    logo,
    recording.mime,
    cb.onCapture ?? (() => {}),
  );
  cleanup();

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
    const ffmpeg = await getFFmpeg(cb.onLog);
    ffmpeg.on('progress', ({ progress }) => cb.onEncode?.(Math.min(1, progress)));
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
  }
}
