// YouVersion Guided Scripture video library.
// Stories 4.0 maps a date → lessons (each may carry a video_id); Videos 5.0
// resolves a video_id → playback sources. Both are reached through same-origin
// proxies (see vite.config.ts) so the browser avoids CORS and canvas tainting.
// Mirrors alfred/video_api (client.py, stories.py).

const STORIES = '/api/yvs/4.0';
const VIDEOS = '/api/yvv/5.0';
const CDN_HOST = 'https://yv-content-assets.youversionapi.com';

export interface LibraryLesson {
  lessonId: number;
  videoId: number | null;
  title: string;
  references: string[];
  date: string;
  language: string;
  organizationId: number | null;
}

export interface PlaybackSources {
  webm?: string;
  hls?: string;
  mp3?: string;
  previewMp4?: string;
  runtime?: number;
  orientation?: string;
}

/** Rewrite a CDN asset URL to the same-origin media proxy. */
export function proxyMedia(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith(CDN_HOST) ? url.replace(CDN_HOST, '/yvmedia') : url;
}

const LESSON_FIELDS =
  'id,title,language_tag,live_date,status,references,video_id,organization_id';

/** Fetch Guided Scripture lessons that went live on a date for a language. */
export async function fetchLessonsForDate(
  date: string,
  language: string,
): Promise<LibraryLesson[]> {
  const qs = new URLSearchParams({
    language_tag: language,
    live_date: date,
    status: '*',
    page_size: '50',
    fields: LESSON_FIELDS,
  });
  const res = await fetch(`${STORIES}/lessons?${qs}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Stories request failed (${res.status})`);
  const json = await res.json();
  const rows = (json?.data ?? []) as Array<{
    id: number;
    video_id?: number | null;
    title?: string;
    references?: string[];
    live_date?: string;
    language_tag?: string;
    organization_id?: number | null;
  }>;
  return rows.map((r) => ({
    lessonId: r.id,
    videoId: r.video_id ?? null,
    title: r.title ?? `Lesson ${r.id}`,
    references: r.references ?? [],
    date: r.live_date ?? date,
    language: r.language_tag ?? language,
    organizationId: r.organization_id ?? null,
  }));
}

/** Resolve playback sources for a video_id (URLs rewritten to the proxy). */
export async function resolvePlayback(
  videoId: number,
  language = 'en',
): Promise<PlaybackSources> {
  const qs = new URLSearchParams({ 'language_ranges[]': language });
  const res = await fetch(`${VIDEOS}/videos/${videoId}?${qs}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Videos request failed (${res.status})`);
  const v = await res.json();
  const out: PlaybackSources = {
    runtime: v.runtime,
    orientation: v.orientation,
  };
  for (const s of v.playback_sources ?? []) {
    const fmt = (s.format ?? '').toLowerCase();
    if (fmt === 'webm') out.webm = proxyMedia(s.url);
    else if (fmt === 'hls') out.hls = proxyMedia(s.url);
    else if (fmt === 'mp3') out.mp3 = proxyMedia(s.url);
  }
  for (const s of v.playback_preview_sources ?? []) {
    if ((s.format ?? '').toLowerCase() === 'mp4') out.previewMp4 = proxyMedia(s.url);
  }
  return out;
}

/** Best background-video URL for canvas compositing: full webm, else preview mp4. */
export function pickBackgroundUrl(p: PlaybackSources): string | undefined {
  return p.webm || p.previewMp4;
}

// --- Seeded catalog ("database") -------------------------------------------

export interface ManifestEntry {
  videoId: number;
  lessonId: number | null;
  title: string;
  language: string;
  organization: string | null;
  references: string[];
  runtime: number | null;
}

/** Locally stored video pulled from an external source (e.g. YouTube via yt-dlp). */
export interface ImportedVideoEntry {
  id: string;
  source: 'youtube';
  sourceUrl: string;
  title: string;
  file: string;
  language: string;
  runtime: number;
  references?: string[];
}

export interface VideoManifest {
  source: string;
  note?: string;
  dates: Record<string, ManifestEntry[]>;
  imports?: ImportedVideoEntry[];
}

let manifestCache: VideoManifest | null = null;

/** Load the pre-populated video catalog shipped in public/assets/videos. */
export async function loadManifest(): Promise<VideoManifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch('/assets/videos/manifest.json');
  if (!res.ok) throw new Error('video manifest not found');
  manifestCache = (await res.json()) as VideoManifest;
  return manifestCache;
}

/**
 * List videos for a date: prefer a live Stories pull for the language; fall
 * back to the seeded manifest (which any user can browse without the API).
 */
export async function listVideosForDate(
  date: string,
  language: string,
): Promise<ManifestEntry[]> {
  try {
    const lessons = await fetchLessonsForDate(date, language);
    const withVideo = lessons.filter((l) => l.videoId != null);
    if (withVideo.length) {
      return withVideo.map((l) => ({
        videoId: l.videoId as number,
        lessonId: l.lessonId,
        title: l.title,
        language: l.language,
        organization: null,
        references: l.references,
        runtime: null,
      }));
    }
  } catch {
    /* fall back to seeded manifest */
  }
  const manifest = await loadManifest();
  const all = manifest.dates[date] ?? [];
  const inLang = all.filter((e) => e.language === language);
  return inLang.length ? inLang : all;
}

/** List imported videos shipped under public/assets/videos/. */
export async function listImportedVideos(): Promise<ImportedVideoEntry[]> {
  const manifest = await loadManifest();
  return manifest.imports ?? [];
}

/** Same-origin URL for a locally stored imported video file. */
export function importedVideoUrl(entry: ImportedVideoEntry): string {
  return `/assets/videos/${entry.file}`;
}
