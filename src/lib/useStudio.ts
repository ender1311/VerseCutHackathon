import { useCallback, useEffect, useMemo, useState } from 'react';
import { ASPECT_DIMENSIONS, config, type AspectRatio, type OutputFormat } from '../config';
import { getBibleProvider, type BibleVersion, type Book, type Language } from './bible';
import { renderImage, renderVideo, type RenderedAsset } from './render';
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

export interface Stage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  progress?: number;
}

export type Phase = 'idle' | 'running' | 'done' | 'error';

const MAX_VERSE = 176; // Psalm 119

export function useStudio() {
  const provider = useMemo(() => getBibleProvider(), []);

  // Reference data
  const [languages, setLanguages] = useState<Language[]>([]);
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [books, setBooks] = useState<Book[]>([]);

  // Form selections
  const [languageId, setLanguageId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState(3);
  const [fromVerse, setFromVerse] = useState(16);
  const [toVerse, setToVerse] = useState(17);

  const [imageFile, setImageFileState] = useState<File | null>(null);
  const [videoFile, setVideoFileState] = useState<File | null>(null);
  const [libraryVideo, setLibraryVideo] = useState<SelectedLibraryVideo | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [format, setFormat] = useState<OutputFormat>(config.output.defaultFormat);
  const [aspect, setAspect] = useState<AspectRatio>(config.output.defaultAspect);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png');
  const [durationSec, setDurationSec] = useState<number>(config.output.videoDurationSec);
  const [logoStyle, setLogoStyle] = useState<LogoStyle>(config.brand.defaultLogoStyle);

  // Generation
  const [phase, setPhase] = useState<Phase>('idle');
  const [stages, setStages] = useState<Stage[]>([]);
  const [asset, setAsset] = useState<RenderedAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load languages once; default to English when available.
  useEffect(() => {
    provider.listLanguages().then((langs) => {
      setLanguages(langs);
      const def =
        langs.find((l) => l.id === 'eng' || l.id === 'en') ??
        langs.find((l) => /^english$/i.test(l.name)) ??
        langs[0];
      if (def) setLanguageId(def.id);
    });
  }, [provider]);

  // Load versions + books when language changes.
  useEffect(() => {
    if (!languageId) return;
    let active = true;
    provider.listVersions(languageId).then((vs) => {
      if (!active) return;
      setVersions(vs);
      const def = vs.find((v) => v.id === config.bible.defaultVersionId) ?? vs[0];
      setVersionId(def?.id ?? '');
    });
    return () => {
      active = false;
    };
  }, [provider, languageId]);

  useEffect(() => {
    if (!versionId) return;
    let active = true;
    provider.listBooks(versionId).then((bs) => {
      if (!active) return;
      setBooks(bs);
      setBookId((prev) => prev || bs.find((b) => b.id === 'JHN')?.id || bs[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [provider, versionId]);

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
  const setImageFile = useCallback((f: File | null) => {
    setImageFileState(f);
    if (f) {
      setVideoFileState(null);
      setLibraryVideo(null);
    }
  }, []);
  const setVideoFile = useCallback((f: File | null) => {
    setVideoFileState(f);
    if (f) {
      setImageFileState(null);
      setLibraryVideo(null);
    }
  }, []);

  /** Browse the library for a date + the selected language. */
  const browseVideos = useCallback(
    (date: string) => listVideosForDate(date, languageId || 'en'),
    [languageId],
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
      setLibraryVideo({ entry, url });
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
      setLibraryVideo({ entry, url: importedVideoUrl(entry) });
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  const clearLibraryVideo = useCallback(() => setLibraryVideo(null), []);

  const canGenerate =
    !!languageId && !!bookId && fromVerse >= 1 && toVerse >= fromVerse && phase !== 'running';

  const patchStage = useCallback(
    (id: string, patch: Partial<Stage>) =>
      setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [],
  );

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setPhase('running');
    setError(null);
    setAsset(null);

    const composeLabel =
      format === 'video' ? 'Compositing frames' : 'Compositing layers';
    const renderLabel = format === 'video' ? 'Encoding MP4' : 'Exporting image';
    const initial: Stage[] = [
      { id: 'fetch', label: 'Fetching verse', status: 'active' },
      { id: 'compose', label: composeLabel, status: 'pending' },
      { id: 'render', label: renderLabel, status: 'pending' },
    ];
    setStages(initial);

    try {
      const effectiveVersionId = versionId || config.bible.defaultVersionId;
      const passage = await provider.fetchPassage({
        versionId: effectiveVersionId,
        bookId,
        chapter,
        fromVerse,
        toVerse,
      });
      patchStage('fetch', { status: 'done' });
      patchStage('compose', { status: 'active' });

      const dimensions = ASPECT_DIMENSIONS[aspect];
      const input = {
        passage,
        aspect,
        dimensions,
        imageFile,
        videoFile,
        videoUrl: libraryVideo?.url ?? null,
        mimeType: (imageFormat === 'jpg' ? 'image/jpeg' : 'image/png') as
          | 'image/png'
          | 'image/jpeg',
        languageId,
        logoStyle,
        durationSec,
      };

      let result: RenderedAsset;
      if (format === 'image') {
        result = await renderImage(input);
        patchStage('compose', { status: 'done' });
        patchStage('render', { status: 'done', progress: 1 });
      } else {
        result = await renderVideo(input, {
          onCapture: (f) => patchStage('compose', { progress: f }),
          onEncode: (f) => {
            patchStage('compose', { status: 'done' });
            patchStage('render', { status: 'active', progress: f });
          },
        });
        patchStage('compose', { status: 'done' });
        patchStage('render', { status: 'done', progress: 1 });
      }

      setAsset(result);
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStages((prev) =>
        prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
      );
      setPhase('error');
    }
  }, [
    canGenerate,
    format,
    versionId,
    provider,
    languageId,
    bookId,
    chapter,
    fromVerse,
    toVerse,
    aspect,
    imageFile,
    videoFile,
    libraryVideo,
    imageFormat,
    logoStyle,
    durationSec,
    patchStage,
  ]);

  return {
    // data
    languages,
    versions,
    books,
    maxChapter,
    maxVerse: MAX_VERSE,
    // form
    languageId,
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
    format,
    setFormat,
    aspect,
    setAspect,
    imageFormat,
    setImageFormat,
    durationSec,
    setDurationSec,
    logoStyle,
    setLogoStyle,
    // generation
    phase,
    stages,
    asset,
    error,
    canGenerate,
    generate,
  };
}
