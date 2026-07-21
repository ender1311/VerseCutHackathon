import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultCta } from './cta';
import { SOCIAL_FORMAT_BY_ID } from './socialFormats';
import { synthesize, preloadTts, ttsState, hasWebGPU } from './tts';
import { defaultVoice, voiceSupported, VOICES } from './voices';
import { ASPECT_DIMENSIONS, config, type AspectRatio, type OutputFormat } from '../config';
import { GRADIENTS, DEFAULT_GRADIENT_ID } from './gradients';
import { getBibleProvider, type BibleVersion, type Book, type Language } from './bible';
import { renderImage, renderVideo, type RenderedAsset } from './render';
import { readStoredAppSettings } from './appSettings';
import type { LogoStyle } from './iconCatalog';
import {
  importedVideoUrl,
  listVideosForDate,
  pickBackgroundUrl,
  resolvePlayback,
  type ImportedVideoEntry,
  type ManifestEntry,
} from './videoLibrary';

export interface SelectedLibraryVideo {
  entry: ManifestEntry | ImportedVideoEntry;
  url: string;
}

/** Photographer credit required when the background is an Unsplash hotlink. */
export interface UnsplashAttribution {
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
}

export interface SharedBackground {
  url: string;
  label: string;
  kind: 'image' | 'video';
  attribution?: UnsplashAttribution;
}

export interface Stage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  progress?: number;
}

export type Phase = 'idle' | 'running' | 'done' | 'error';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  label: string;
  aspect: AspectRatio;
  format: OutputFormat;
  kind: 'image' | 'video';
  status: JobStatus;
  stages: Stage[];
  asset: RenderedAsset | null;
  error: string | null;
  reference: string | null;
  versionAbbr: string | null;
  language: string;
  /** Build-time estimate (seconds) captured when the job was queued. */
  estimateSec: number;
  /** Epoch ms when the render actually started (null while queued). */
  startedAt: number | null;
}

interface JobSnapshot {
  versionId: string;
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
  format: OutputFormat;
  useVoiceover: boolean;
  voiceId: string | null;
  durationSec: number;
  render: {
    aspect: AspectRatio;
    dimensions: { width: number; height: number };
    imageFile: File | null;
    videoFile: File | null;
    imageUrl: string | null;
    videoUrl: string | null;
    mimeType: 'image/png' | 'image/jpeg';
    languageId: string;
    logoStyle: LogoStyle;
    template: 'classic' | 'promo';
    cta: string;
    musicFile: File | null;
    gradientId: string;
    gradientHex: string | null;
  };
}

const MAX_VERSE = 176; // Psalm 119
const MAX_JOBS = 12; // retained render-history depth (older jobs' URLs are revoked)

export function useStudio() {
  const provider = useMemo(() => getBibleProvider(), []);

  // Reference data
  const [languages, setLanguages] = useState<Language[]>([]);
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form selections
  // Prefill the verse range from the user's saved default (Settings), falling
  // back to John 3:16-17.
  const verseDefault = useMemo(() => readStoredAppSettings().verseDefault, []);
  const [languageId, setLanguageId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState(verseDefault?.chapter ?? 3);
  const [fromVerse, setFromVerse] = useState(verseDefault?.fromVerse ?? 16);
  const [toVerse, setToVerse] = useState(verseDefault?.toVerse ?? 17);

  const [imageFile, setImageFileState] = useState<File | null>(null);
  const [videoFile, setVideoFileState] = useState<File | null>(null);
  const [libraryVideo, setLibraryVideo] = useState<SelectedLibraryVideo | null>(null);
  const [sharedBg, setSharedBg] = useState<SharedBackground | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [format, setFormat] = useState<OutputFormat>(config.output.defaultFormat);
  const [aspect, setAspectState] = useState<AspectRatio>(config.output.defaultAspect);
  const [platform, setPlatform] = useState<string | null>(null);
  const selectPlatform = useCallback((id: string) => {
    setPlatform(id);
    const fmt = SOCIAL_FORMAT_BY_ID[id];
    if (fmt) setAspectState(fmt.aspect);
  }, []);
  // Manual aspect changes clear a mismatched platform so safe-area overlays stay in sync.
  const setAspect = useCallback((next: AspectRatio) => {
    setAspectState(next);
    setPlatform((prev) => {
      if (!prev) return prev;
      const fmt = SOCIAL_FORMAT_BY_ID[prev];
      return fmt && fmt.aspect === next ? prev : null;
    });
  }, []);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png');
  const [durationSec, setDurationSec] = useState<number>(config.output.videoDurationSec);
  const [logoStyle, setLogoStyle] = useState<LogoStyle>(config.brand.defaultLogoStyle);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [gradientId, setGradientIdState] = useState<string>(DEFAULT_GRADIENT_ID);
  const [customColor, setCustomColor] = useState<string | null>(null);
  // Preset and custom color are mutually exclusive: picking a preset clears the
  // custom color, and vice versa (handled where setCustomColor is called).
  const setGradientId = useCallback((id: string) => {
    setGradientIdState(id);
    setCustomColor(null);
  }, []);
  const [voiceover, setVoiceoverState] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const voiceTouched = useRef(false);
  const [template, setTemplate] = useState<'classic' | 'promo'>('classic');
  const [cta, setCtaState] = useState<string>(defaultCta('en'));
  const ctaTouched = useRef(false);
  const setCta = useCallback((v: string) => {
    ctaTouched.current = true;
    setCtaState(v);
  }, []);

  // Generation — a queue of background jobs. Generating snapshots the form into
  // a job and renders it in the background, so the form stays editable and more
  // jobs can be queued. Renders run one at a time (real-time canvas capture
  // can't safely run two videos concurrently).
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const queueRef = useRef<{ id: string; snap: JobSnapshot }[]>([]);
  const runningRef = useRef(false);
  const jobSeq = useRef(0);

  // Revoke completed-render object URLs when their jobs are evicted or the
  // studio unmounts — otherwise each render leaks a blob URL for the session.
  const jobsRef = useRef<Job[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(
    () => () => {
      for (const j of jobsRef.current) {
        if (j.asset?.url) URL.revokeObjectURL(j.asset.url);
      }
    },
    [],
  );

  // Load languages once; default to English when available.
  useEffect(() => {
    let active = true;
    provider
      .listLanguages()
      .then((langs) => {
        if (!active) return;
        setCatalogError(null);
        setLanguages(langs);
        const def =
          langs.find((l) => l.id === 'i:en' || l.id === 'en' || l.id === 'eng') ??
          langs.find((l) => /^english$/i.test(l.name)) ??
          langs[0];
        if (def) setLanguageId(def.id);
      })
      .catch(() => {
        if (!active) return;
        setCatalogError('Could not load languages. Check your connection and try again.');
      });
    return () => {
      active = false;
    };
  }, [provider]);

  // Load versions + books when language changes.
  useEffect(() => {
    if (!languageId) return;
    let active = true;
    provider
      .listVersions(languageId)
      .then((vs) => {
        if (!active) return;
        setCatalogError(null);
        setVersions(vs);
        const def =
          vs.find((v) => v.id === config.bible.defaultVersionId) ??
          vs.find((v) => v.id.endsWith(`:${config.bible.defaultVersionId}`)) ??
          vs[0];
        setVersionId(def?.id ?? '');
      })
      .catch(() => {
        if (!active) return;
        setVersions([]);
        setVersionId('');
        setCatalogError('Could not load Bible versions. Check your connection and try again.');
      });
    return () => {
      active = false;
    };
  }, [provider, languageId]);

  useEffect(() => {
    if (!versionId) return;
    let active = true;
    provider
      .listBooks(versionId)
      .then((bs) => {
        if (!active) return;
        setCatalogError(null);
        setBooks(bs);
        const preferred =
          (verseDefault?.book && bs.find((b) => b.id === verseDefault.book)?.id) ||
          bs.find((b) => b.id === 'JHN')?.id ||
          bs[0]?.id ||
          '';
        setBookId((prev) => prev || preferred);
      })
      .catch(() => {
        if (!active) return;
        setBooks([]);
        setBookId('');
        setCatalogError('Could not load books. Check your connection and try again.');
      });
    return () => {
      active = false;
    };
  }, [provider, versionId, verseDefault]);

  // Bare language code (the picker ids are source-prefixed, e.g. "i:af" / "p:aai").
  const languageCode = languageId.includes(':')
    ? languageId.slice(languageId.indexOf(':') + 1)
    : languageId;

  // Seed the CTA with the language's localized default until the user edits it.
  useEffect(() => {
    if (!ctaTouched.current) setCtaState(defaultCta(languageCode));
  }, [languageCode]);

  const voiceSupportedForLang = voiceSupported(languageCode);
  const voices = useMemo(() => {
    const base = languageCode.split(/[-_]/)[0];
    return VOICES.filter((v) => v.lang === base);
  }, [languageCode]);

  // On language change, reset to that language's default Kokoro voice (a voice
  // picked for the previous language doesn't apply here). If the new language
  // isn't covered, disable voiceover.
  useEffect(() => {
    voiceTouched.current = false;
    setVoiceId(defaultVoice(languageCode));
    if (!voiceSupported(languageCode)) setVoiceoverState(false);
  }, [languageCode]);

  const setVoice = useCallback((id: string) => {
    voiceTouched.current = true;
    setVoiceId(id);
  }, []);

  // Toggling voiceover on kicks off the (cached) model download early.
  const setVoiceover = useCallback((on: boolean) => {
    setVoiceoverState(on);
    if (on) preloadTts();
  }, []);

  // ttsState() reads module-level mutable vars, so mirror it into React state
  // and poll while the model loads — otherwise the download progress UI never
  // updates.
  const [ttsStatus, setTtsStatus] = useState(() => ttsState());
  useEffect(() => {
    if (!voiceover) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = ttsState();
      setTtsStatus((prev) => (prev.status === s.status && prev.pct === s.pct ? prev : s));
      if (s.status === 'idle' || s.status === 'loading') timer = setTimeout(tick, 250);
    };
    tick();
    return () => clearTimeout(timer);
  }, [voiceover]);

  const currentBook = books.find((b) => b.id === bookId);
  const maxChapter = currentBook?.chapters ?? 150;

  // Keep ranges coherent.
  useEffect(() => {
    if (chapter > maxChapter) setChapter(maxChapter);
  }, [maxChapter, chapter]);

  const setFrom = useCallback(
    (v: number) => {
      setFromVerse(v);
      if (v > toVerse) setToVerse(v);
    },
    [toVerse],
  );
  const setTo = useCallback(
    (v: number) => setToVerse(Math.max(v, fromVerse)),
    [fromVerse],
  );

  // A background source is exclusive: choosing one clears the others.
  // Clearing selectedJobId returns Preview to draft mode so a prior render
  // doesn't mask the newly picked background.
  const setImageFile = useCallback((f: File | null) => {
    setImageFileState(f);
    if (f) {
      setVideoFileState(null);
      setLibraryVideo(null);
      setSharedBg(null);
      setSelectedJobId(null);
    }
  }, []);
  const setVideoFile = useCallback((f: File | null) => {
    setVideoFileState(f);
    if (f) {
      setImageFileState(null);
      setLibraryVideo(null);
      setSharedBg(null);
      setSelectedJobId(null);
    }
  }, []);

  /** Pick a team-shared background (image or video) by URL. */
  const selectSharedAsset = useCallback(
    (asset: { fileUrl: string; name: string; kind: 'image' | 'video' }) => {
      setImageFileState(null);
      setVideoFileState(null);
      setLibraryVideo(null);
      setSharedBg({ url: asset.fileUrl, label: asset.name, kind: asset.kind });
      setSelectedJobId(null);
    },
    [],
  );

  /** Pick an Unsplash photo (hotlinked URL + attribution). */
  const selectUnsplashPhoto = useCallback(
    (photo: {
      url: string;
      label: string;
      attribution: UnsplashAttribution;
    }) => {
      setImageFileState(null);
      setVideoFileState(null);
      setLibraryVideo(null);
      setSharedBg({
        url: photo.url,
        label: photo.label,
        kind: 'image',
        attribution: photo.attribution,
      });
      setSelectedJobId(null);
    },
    [],
  );
  const clearSharedBg = useCallback(() => setSharedBg(null), []);

  /** Browse the library for a date + the selected language. */
  const browseVideos = useCallback(
    (date: string) => listVideosForDate(date, languageCode || 'en'),
    [languageCode],
  );

  /** Pick a library video: resolve its playback URL and set it as the background. */
  const selectLibraryVideo = useCallback(async (entry: ManifestEntry) => {
    setLibraryBusy(true);
    try {
      const playback = await resolvePlayback(entry.videoId, entry.language);
      const url = pickBackgroundUrl(playback);
      if (!url) throw new Error('No playable source for this video');
      setImageFileState(null);
      setVideoFileState(null);
      setSharedBg(null);
      setLibraryVideo({ entry, url });
      setSelectedJobId(null);
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  /** Pick a locally stored imported video (e.g. YouTube pull). */
  const selectImportedVideo = useCallback(async (entry: ImportedVideoEntry) => {
    setLibraryBusy(true);
    try {
      setImageFileState(null);
      setVideoFileState(null);
      setSharedBg(null);
      setLibraryVideo({ entry, url: importedVideoUrl(entry) });
      setSelectedJobId(null);
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  const clearLibraryVideo = useCallback(() => setLibraryVideo(null), []);

  const canGenerate =
    !!languageId && !!bookId && fromVerse >= 1 && toVerse >= fromVerse;
  const generateBlockedReason = !canGenerate
    ? !languageId
      ? 'Choose a language'
      : !bookId
        ? 'Choose a book'
        : 'Enter a valid verse range'
    : null;

  const patchJob = useCallback(
    (id: string, patch: Partial<Job>) =>
      setJobs((prev) => {
        // If the job was evicted (history cap) while its render was in flight,
        // revoke the finished asset's object URL so it isn't leaked.
        if (!prev.some((j) => j.id === id)) {
          if (patch.asset?.url) URL.revokeObjectURL(patch.asset.url);
          return prev;
        }
        return prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
      }),
    [],
  );

  const patchJobStage = useCallback(
    (id: string, stageId: string, patch: Partial<Stage>) =>
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, stages: j.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) }
            : j,
        ),
      ),
    [],
  );

  const runJob = useCallback(
    async (id: string, snap: JobSnapshot) => {
      patchJob(id, { status: 'running', startedAt: Date.now() });
      patchJobStage(id, 'fetch', { status: 'active' });
      try {
        const passage = await provider.fetchPassage({
          versionId: snap.versionId,
          bookId: snap.bookId,
          chapter: snap.chapter,
          fromVerse: snap.fromVerse,
          toVerse: snap.toVerse,
        });
        patchJobStage(id, 'fetch', { status: 'done' });
        patchJob(id, {
          label: passage.reference,
          reference: passage.reference,
          versionAbbr: passage.versionAbbreviation,
        });

        let narrationBlob: Blob | null = null;
        let effectiveDuration = snap.durationSec;
        if (snap.useVoiceover && snap.voiceId) {
          patchJobStage(id, 'voice', { status: 'active' });
          const narration = await synthesize(
            `${passage.text} ${passage.reference}`,
            snap.voiceId,
            (pct) => patchJobStage(id, 'voice', { progress: pct / 100 }),
          );
          narrationBlob = narration.blob;
          // Give the verse room to finish, plus a short tail.
          effectiveDuration = Math.max(snap.durationSec, Math.ceil(narration.durationSec) + 1);
          patchJobStage(id, 'voice', { status: 'done', progress: 1 });
        }

        patchJobStage(id, 'compose', { status: 'active' });
        const input = {
          ...snap.render,
          passage,
          durationSec: effectiveDuration,
          narrationBlob,
        };

        let result: RenderedAsset;
        if (snap.format === 'image') {
          result = await renderImage(input);
          patchJobStage(id, 'compose', { status: 'done' });
          patchJobStage(id, 'render', { status: 'done', progress: 1 });
        } else {
          result = await renderVideo(input, {
            onCapture: (f) => patchJobStage(id, 'compose', { progress: f }),
            onEncode: (f) => {
              patchJobStage(id, 'compose', { status: 'done' });
              patchJobStage(id, 'render', { status: 'active', progress: f });
            },
          });
          patchJobStage(id, 'compose', { status: 'done' });
          patchJobStage(id, 'render', { status: 'done', progress: 1 });
        }

        patchJob(id, { status: 'done', asset: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: 'error',
                  error: message,
                  stages: j.stages.map((s) =>
                    s.status === 'active' ? { ...s, status: 'error' } : s,
                  ),
                }
              : j,
          ),
        );
      }
    },
    [provider, patchJob, patchJobStage],
  );

  // Drain the queue one job at a time.
  const pump = useCallback(async () => {
    if (runningRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    runningRef.current = true;
    try {
      await runJob(next.id, next.snap);
    } finally {
      runningRef.current = false;
      void pump();
    }
  }, [runJob]);

  // Rough build-time estimate (seconds) shown before Generate. Video capture is
  // real-time, so duration dominates; voiceover adds a one-time model download
  // (cached after first run) plus synthesis.
  const estimateSec = useMemo(() => {
    if (format === 'image') return 3;
    const useVoiceover = voiceover && !!voiceId && voiceSupportedForLang;
    let s = durationSec + 3; // real-time capture + encode
    if (useVoiceover) {
      if (ttsStatus.status !== 'ready') s += hasWebGPU() ? 20 : 35; // model download/warmup
      s += hasWebGPU() ? 6 : 12; // synthesis
    }
    return Math.round(s);
  }, [format, durationSec, voiceover, voiceId, voiceSupportedForLang, ttsStatus.status]);

  const generate = useCallback(() => {
    if (!canGenerate) return;
    const id = `job-${(jobSeq.current += 1)}`;
    const useVoiceover =
      format === 'video' && voiceover && !!voiceId && voiceSupportedForLang;
    const composeLabel =
      format === 'video' ? 'Compositing frames' : 'Compositing layers';
    const renderLabel = format === 'video' ? 'Encoding MP4' : 'Exporting image';
    const stages: Stage[] = [
      { id: 'fetch', label: 'Fetching verse', status: 'pending' },
      ...(useVoiceover
        ? [{ id: 'voice', label: 'Synthesizing voiceover', status: 'pending' as const }]
        : []),
      { id: 'compose', label: composeLabel, status: 'pending' },
      { id: 'render', label: renderLabel, status: 'pending' },
    ];

    const provisionalRef =
      `${currentBook?.name ?? bookId} ${chapter}:${fromVerse}` +
      (toVerse > fromVerse ? `-${toVerse}` : '');

    const snap: JobSnapshot = {
      versionId: versionId || config.bible.defaultVersionId,
      bookId,
      chapter,
      fromVerse,
      toVerse,
      format,
      useVoiceover,
      voiceId,
      durationSec,
      render: {
        aspect,
        dimensions: ASPECT_DIMENSIONS[aspect],
        imageFile,
        videoFile,
        imageUrl: sharedBg?.kind === 'image' ? sharedBg.url : null,
        videoUrl: libraryVideo?.url ?? (sharedBg?.kind === 'video' ? sharedBg.url : null),
        mimeType: imageFormat === 'jpg' ? 'image/jpeg' : 'image/png',
        languageId: languageCode,
        logoStyle,
        template,
        cta,
        musicFile,
        gradientId,
        gradientHex: customColor,
      },
    };

    const job: Job = {
      id,
      label: provisionalRef,
      aspect,
      format,
      kind: format === 'image' ? 'image' : 'video',
      status: 'queued',
      stages,
      asset: null,
      error: null,
      reference: null,
      versionAbbr: null,
      language: languageId,
      estimateSec,
      startedAt: null,
    };

    setJobs((prev) => {
      const next = [job, ...prev];
      // Keep a bounded history; revoke evicted jobs' asset URLs so blobs aren't
      // pinned for the whole session.
      if (next.length > MAX_JOBS) {
        for (const dropped of next.slice(MAX_JOBS)) {
          if (dropped.asset?.url) URL.revokeObjectURL(dropped.asset.url);
        }
        return next.slice(0, MAX_JOBS);
      }
      return next;
    });
    setSelectedJobId(id);
    queueRef.current.push({ id, snap });
    void pump();
  }, [
    canGenerate,
    format,
    versionId,
    languageId,
    languageCode,
    bookId,
    currentBook,
    chapter,
    fromVerse,
    toVerse,
    aspect,
    imageFile,
    videoFile,
    libraryVideo,
    sharedBg,
    imageFormat,
    logoStyle,
    template,
    cta,
    durationSec,
    musicFile,
    gradientId,
    customColor,
    voiceover,
    voiceId,
    voiceSupportedForLang,
    estimateSec,
    pump,
  ]);

  // null selectedJobId means draft Preview (show form background), not "fall
  // back to the newest job" — picking a new background clears the selection.
  const selectedJob = useMemo(
    () => (selectedJobId ? (jobs.find((j) => j.id === selectedJobId) ?? null) : null),
    [jobs, selectedJobId],
  );
  const isRendering = jobs.some((j) => j.status === 'running' || j.status === 'queued');

  return {
    // data
    languages,
    versions,
    books,
    catalogError,
    maxChapter,
    maxVerse: MAX_VERSE,
    // form
    languageId,
    languageCode,
    setLanguageId,
    versionId,
    setVersionId,
    bookId,
    setBookId,
    chapter,
    setChapter,
    fromVerse,
    setFrom,
    toVerse,
    setTo,
    imageFile,
    setImageFile,
    videoFile,
    setVideoFile,
    // video library
    libraryVideo,
    libraryBusy,
    browseVideos,
    selectLibraryVideo,
    selectImportedVideo,
    clearLibraryVideo,
    // shared backgrounds
    sharedBg,
    selectSharedAsset,
    selectUnsplashPhoto,
    clearSharedBg,
    format,
    setFormat,
    aspect,
    setAspect,
    platform,
    selectPlatform,
    imageFormat,
    setImageFormat,
    durationSec,
    setDurationSec,
    logoStyle,
    setLogoStyle,
    template,
    setTemplate,
    cta,
    setCta,
    musicFile,
    setMusicFile,
    // background gradient
    gradients: GRADIENTS,
    gradientId,
    setGradientId,
    customColor,
    setCustomColor,
    // voiceover
    voiceover,
    setVoiceover,
    voiceId,
    setVoice,
    voices,
    voiceSupportedForLang,
    ttsStatus,
    estimateSec,
    // generation (background job queue)
    jobs,
    selectedJob,
    selectJob: setSelectedJobId,
    isRendering,
    canGenerate,
    generateBlockedReason,
    generate,
  };
}
