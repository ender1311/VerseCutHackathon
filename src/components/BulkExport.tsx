'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SpaceShell } from './SpaceShell';
import { Button, FieldLabel, Select, SearchableSelect, Stepper } from './ui';
import { ASPECT_DIMENSIONS, type AspectRatio } from '../config';
import type { LogoStyle } from '../lib/iconCatalog';
import { renderImage } from '../lib/render';
import { isDarkBackground, type Background } from '../lib/compositor';
import { resolveGradient, gradientFromHex } from '../lib/gradients';
import { YouVersionInternalProvider, loadBibleManifest } from '../lib/bible/internalProvider';
import type { Book } from '../lib/bible';
import { uploadImageToAir } from '../lib/export/airClient';
import { uploadImageToAws } from '../lib/export/awsClient';
import { uploadImageToBraze } from '../lib/export/brazeClient';
import { exportFolder, exportAssetPath } from '../lib/export/awsPath';
import { geoUploaderFor } from '../lib/export/geoUpload';
import { resolveBulkLogo } from '../lib/export/logo';
import { runVersionExport, type ExportVersion } from '../lib/export/versionExport';
import { useStudio } from '../lib/useStudio';
import { GradientPicker } from './studio/controls';
import { LibraryModal } from './shells/LibraryModal';
import type { LibraryView } from '../lib/libraryView';

type Destination = 'aws' | 'air' | 'braze';
const DESTINATIONS: { value: Destination; label: string }[] = [
  { value: 'aws', label: 'AWS S3' },
  { value: 'air', label: 'AIR' },
  { value: 'braze', label: 'Braze media library' },
];
import { prioritizeVersions, DEFAULT_PRIORITY_CODES } from '../lib/export/versionOrder';
import type { VersionExportRow, GeoLanguageRender, GeoImage } from '../lib/export/types';
import { buildVersionsCsv, buildGeoByCountryCsv, buildGeoByLanguageCsv } from '../lib/export/csv';
import { LANGUAGE_COUNTRY } from '../lib/export/languageCountry';
import { planGeoQueries, buildGeoResults, type RawGeoPhoto } from '../lib/export/geoBackgrounds';
import { loadBulkExportPrefs, saveBulkExportPrefs } from '../lib/export/bulkExportPrefs';

// English NIV — used for the live preview render.
const PREVIEW_VERSION = '111';

// Populate the book dropdown from a widely-available version (NIV).
const BOOK_LIST_VERSION = '111';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the download has started before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Decode an image URL to an HTMLImageElement (CORS-enabled for canvas use). */
function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load background: ${src}`));
    img.src = src;
  });
}

/** Bounded-concurrency map (preserves input order in the result). Stops taking
 *  new items once `shouldStop` returns true (in-flight items still finish). */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>,
  shouldStop?: () => boolean,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      if (shouldStop?.()) break;
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker));
  return out;
}

class RateLimitError extends Error {}

async function fetchCountryPhotos(country: string, capital: string): Promise<RawGeoPhoto[]> {
  const out: RawGeoPhoto[] = [];
  for (const query of planGeoQueries({ country, capital })) {
    const res = await fetch(
      `/api/unsplash/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
    );
    if (res.status === 429) {
      throw new RateLimitError('Unsplash rate limit hit (429) — wait and retry, or use a production Unsplash key.');
    }
    if (!res.ok) continue; // genuine no-results / transient; skip this query
    const json = (await res.json()) as { data?: { photos?: RawGeoPhoto[] } };
    for (const p of json.data?.photos ?? []) out.push(p);
  }
  return out;
}

export function BulkExport({ userEmail }: { userEmail?: string | null }) {
  const provider = useMemo(() => new YouVersionInternalProvider(), []);
  // Studio drives shared background selection (gradient/color/upload/YouVersion/Unsplash),
  // reusing the exact sources from the single-asset generator.
  const studio = useStudio();
  const [libOpen, setLibOpen] = useState(false);
  const [libView, setLibView] = useState<LibraryView>('unsplash');
  const [logoStyle, setLogoStyle] = useState<LogoStyle>('logo-light');
  const [aspect, setAspect] = useState<AspectRatio>('1:1');
  const [destination, setDestination] = useState<Destination>('aws');
  const [exportType, setExportType] = useState<'versions' | 'geo'>('versions');

  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('JHN');
  const [chapter, setChapter] = useState(3);
  const [fromVerse, setFromVerse] = useState(16);
  const [toVerse, setToVerse] = useState(16);
  // 0 = every version; a small number renders just the first N (after
  // prioritizing major languages) so you can smoke-test AIR links quickly.
  const [limit, setLimit] = useState(6);

  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(
    null,
  );
  const [rows, setRows] = useState<VersionExportRow[] | null>(null);
  const [geoReady, setGeoReady] = useState<{ byCountry: string; byLanguage: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  // Cooperative cancel flag for the current run (checked by the export loops).
  const stopRef = useRef(false);
  const requestStop = () => {
    stopRef.current = true;
    setStopping(true);
  };
  const [error, setError] = useState<string | null>(null);
  const [failReasons, setFailReasons] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const prefsLoaded = useRef(false);

  useEffect(() => {
    provider
      .listBooks(BOOK_LIST_VERSION)
      .then(setBooks)
      .catch(() => setBooks([]));
  }, [provider]);

  // Restore this user's last-used settings once on mount.
  useEffect(() => {
    const p = loadBulkExportPrefs(userEmail);
    if (p) {
      if (p.bookId) setBookId(p.bookId);
      if (typeof p.chapter === 'number') setChapter(p.chapter);
      if (typeof p.fromVerse === 'number') setFromVerse(p.fromVerse);
      if (typeof p.toVerse === 'number') setToVerse(p.toVerse);
      if (p.logoStyle) setLogoStyle(p.logoStyle as LogoStyle);
      if (p.aspect) setAspect(p.aspect as AspectRatio);
      if (typeof p.limit === 'number') setLimit(p.limit);
      if (p.destination) setDestination(p.destination as Destination);
      if (p.exportType === 'versions' || p.exportType === 'geo') setExportType(p.exportType);
      if (p.gradientId) studio.setGradientId(p.gradientId);
      if (p.customColor) studio.setCustomColor(p.customColor);
    }
    prefsLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // Persist settings per user whenever they change (after the initial restore).
  useEffect(() => {
    if (!prefsLoaded.current) return;
    saveBulkExportPrefs(userEmail, {
      bookId,
      chapter,
      fromVerse,
      toVerse,
      logoStyle,
      aspect,
      limit,
      destination,
      exportType,
      gradientId: studio.gradientId,
      customColor: studio.customColor,
    });
  }, [
    userEmail,
    bookId,
    chapter,
    fromVerse,
    toVerse,
    logoStyle,
    aspect,
    limit,
    destination,
    exportType,
    studio.gradientId,
    studio.customColor,
  ]);

  const currentBook = books.find((b) => b.id === bookId);
  const maxChapter = currentBook?.chapters ?? 150;

  // Resolve the shared background (decoded image + light/dark theme) once.
  async function resolveSharedBackground(): Promise<{
    backgroundImage: CanvasImageSource | null;
    dark: boolean;
  }> {
    let backgroundImage: CanvasImageSource | null = null;
    const sharedUrl = studio.sharedBg?.kind === 'image' ? studio.sharedBg.url : null;
    if (studio.imageFile) {
      const u = URL.createObjectURL(studio.imageFile);
      try {
        backgroundImage = await decodeImage(u);
      } finally {
        URL.revokeObjectURL(u);
      }
    } else if (sharedUrl) {
      backgroundImage = await decodeImage(sharedUrl).catch(() => null);
    }
    const bg: Background = backgroundImage
      ? { type: 'image', image: backgroundImage }
      : {
          type: 'gradient',
          preset: studio.customColor ? gradientFromHex(studio.customColor) : resolveGradient(studio.gradientId),
        };
    return { backgroundImage, dark: isDarkBackground(bg) };
  }

  // Live English (NIV) preview of the final output, debounced on settings changes.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const passage = await provider.fetchPassage({
          versionId: PREVIEW_VERSION,
          bookId,
          chapter,
          fromVerse,
          toVerse,
        });
        const { backgroundImage, dark } = await resolveSharedBackground();
        const base = ASPECT_DIMENSIONS[aspect];
        const scale = Math.min(1, 640 / base.width);
        const asset = await renderImage({
          passage,
          aspect,
          dimensions: { width: Math.round(base.width * scale), height: Math.round(base.height * scale) },
          imageFile: null,
          videoFile: null,
          backgroundImage,
          dark,
          gradientId: studio.gradientId,
          gradientHex: studio.customColor,
          mimeType: 'image/jpeg',
          languageId: 'en',
          logoStyle,
          template: 'classic',
        });
        if (cancelled) {
          URL.revokeObjectURL(asset.url);
          return;
        }
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return asset.url;
        });
      } catch {
        /* preview is best-effort */
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    provider,
    bookId,
    chapter,
    fromVerse,
    toVerse,
    logoStyle,
    aspect,
    studio.imageFile,
    studio.sharedBg,
    studio.gradientId,
    studio.customColor,
  ]);

  // Revoke the last preview URL on unmount.
  useEffect(() => () => setPreviewUrl((u) => (u ? (URL.revokeObjectURL(u), null) : null)), []);

  async function runVersions() {
    setRunning(true);
    stopRef.current = false;
    setStopping(false);
    setError(null);
    setFailReasons([]);
    setRows(null);
    setProgress(null);
    try {
      const reference = { bookId, chapter, fromVerse, toVerse };
      const manifest = await loadBibleManifest();
      const all: ExportVersion[] = [];
      for (const lang of manifest.languages) {
        for (const v of manifest.versionsByTag[lang.tag] ?? []) {
          all.push({ id: v.id, code: lang.code });
        }
      }
      const ordered = prioritizeVersions(all, DEFAULT_PRIORITY_CODES);
      const versions = limit > 0 ? ordered.slice(0, limit) : ordered;

      // Decode the shared background + compute the light/dark theme ONCE for the
      // whole run, instead of per version.
      const { backgroundImage, dark } = await resolveSharedBackground();

      // Organize each run into a dated, verse-named folder across destinations,
      // e.g. versecut/2026-07-21/jhn3_16/<versionId>.jpg
      const dateStr = new Date().toLocaleDateString('en-CA');
      const folder = exportFolder(dateStr, reference);
      const idFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');
      const uploadImage =
        destination === 'aws'
          ? (blob: Blob, fileName: string) =>
              uploadImageToAws(blob, exportAssetPath(dateStr, reference, idFromFile(fileName), 'jpg'))
          : destination === 'braze'
            ? (blob: Blob, fileName: string) =>
                uploadImageToBraze(blob, `${folder}/${idFromFile(fileName)}`)
            : (blob: Blob, fileName: string) =>
                uploadImageToAir(blob, exportAssetPath(dateStr, reference, idFromFile(fileName), 'jpg'));

      // Keep bursts within each destination's limits: Braze media API is
      // 100/hr, AIR is 15 req/s + 10 concurrent (and each AIR upload fans out to
      // register→PUT→cdnLinks). AWS/S3 has no such cap.
      const concurrency = destination === 'braze' ? 2 : destination === 'air' ? 6 : 8;
      const failures: string[] = [];

      const result = await runVersionExport(
        versions,
        {
          fetchPassage: (q) => provider.fetchPassage(q),
          renderImage,
          uploadImage,
        },
        {
          reference,
          aspect,
          dimensions: ASPECT_DIMENSIONS[aspect],
          logoStyle,
          backgroundImage,
          gradientId: studio.gradientId,
          gradientHex: studio.customColor,
          dark,
          concurrency,
          shouldStop: () => stopRef.current,
          onProgress: setProgress,
          onError: (versionId, err) => {
            const m = err instanceof Error ? err.message : String(err);
            console.warn(`[bulk-export] version ${versionId} failed:`, m);
            if (failures.length < 20) failures.push(`${versionId}: ${m}`);
          },
        },
      );
      setFailReasons(failures);
      setRows(result);
      download('versions.csv', buildVersionsCsv(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setRunning(false);
      setStopping(false);
    }
  }

  async function runGeo() {
    setRunning(true);
    stopRef.current = false;
    setError(null);
    setFailReasons([]);
    setGeoReady(null);
    setProgress(null);
    try {
      const reference = { bookId, chapter, fromVerse, toVerse };
      const manifest = await loadBibleManifest();
      // Languages mapped to a country, each with a version to source verse text.
      type GeoLang = { code: string; name: string; country: string; versionId: string };
      const geoLangs: GeoLang[] = manifest.languages
        .filter((l) => LANGUAGE_COUNTRY[l.code])
        .map((l) => ({
          code: l.code,
          name: l.name,
          country: LANGUAGE_COUNTRY[l.code].country,
          versionId: manifest.versionsByTag[l.tag]?.[0]?.id,
        }))
        .filter((l): l is GeoLang => Boolean(l.versionId));

      // Phase 1 — source landmark photos per country (kept low for Unsplash limits).
      const countries = new Map<string, string>();
      for (const l of geoLangs) countries.set(l.country, LANGUAGE_COUNTRY[l.code].capital);
      const entries = [...countries.entries()];
      const photosByCountry = new Map<string, RawGeoPhoto[]>();
      let doneC = 0;
      await mapPool(
        entries,
        4,
        async ([country, capital]) => {
          const photos = await fetchCountryPhotos(country, capital);
          photosByCountry.set(country, photos);
          setProgress({ done: ++doneC, total: entries.length, failed: 0 });
        },
        () => stopRef.current,
      );
      const results = buildGeoResults(
        geoLangs.map((l) => ({ code: l.code, name: l.name })),
        photosByCountry,
        { maxImages: 3 },
      );
      // The top landmark photo per country is the background we render onto.
      const topByCountry = new Map<string, GeoImage>();
      for (const g of results) if (g.images[0]) topByCountry.set(g.country, g.images[0]);

      // Phase 2 — render the verse in each language over its country's top photo
      // (correct language text + localized logo) and upload the localized image.
      const dateStr = new Date().toLocaleDateString('en-CA');
      const uploadGeo = geoUploaderFor(destination, dateStr);
      // Decode + theme each country's top photo once, shared across its languages.
      const bgCache = new Map<string, Promise<{ image: CanvasImageSource; dark: boolean }>>();
      const bgForCountry = (country: string, url: string) => {
        let p = bgCache.get(country);
        if (!p) {
          p = decodeImage(url).then((image) => ({
            image,
            dark: isDarkBackground({ type: 'image', image } as Background),
          }));
          bgCache.set(country, p);
        }
        return p;
      };

      const langTasks = geoLangs.filter((l) => topByCountry.has(l.country));
      const geoConcurrency = destination === 'braze' ? 2 : destination === 'air' ? 6 : 8;
      const rendered: GeoLanguageRender[] = [];
      const geoFailures: string[] = []; // display-capped sample of reasons
      let failedCount = 0; // true failure total (the reasons list is capped at 20)
      let doneU = 0;
      await mapPool(
        langTasks,
        geoConcurrency,
        async (l) => {
          const top = topByCountry.get(l.country)!;
          try {
            const passage = await provider.fetchPassage({ versionId: l.versionId, ...reference });
            const { image, dark } = await bgForCountry(l.country, top.url);
            const logo = resolveBulkLogo(l.code, logoStyle);
            const asset = await renderImage({
              passage,
              aspect,
              dimensions: ASPECT_DIMENSIONS[aspect],
              imageFile: null,
              videoFile: null,
              imageUrl: null,
              backgroundImage: image,
              dark,
              mimeType: 'image/jpeg',
              languageId: logo.languageId,
              logoStyle: logo.logoStyle,
              template: 'classic',
              gradientId: null,
              gradientHex: null,
            });
            let cdn_url = '';
            try {
              cdn_url = await uploadGeo(asset.blob, l.country, l.code);
            } finally {
              URL.revokeObjectURL(asset.url);
            }
            rendered.push({
              language: l.code,
              language_name: l.name,
              country: l.country,
              reference: passage.reference,
              verse_text: passage.text,
              background_url: top.url,
              credit: top.credit,
              cdn_url,
            });
          } catch (err) {
            failedCount++;
            const m = err instanceof Error ? err.message : String(err);
            console.warn(`[geo-export] ${l.country}/${l.code} failed:`, m);
            if (geoFailures.length < 20) geoFailures.push(`${l.country}/${l.code}: ${m}`);
          } finally {
            setProgress({ done: ++doneU, total: langTasks.length, failed: failedCount });
          }
        },
        () => stopRef.current,
      );
      setFailReasons(geoFailures);

      rendered.sort((a, b) => a.language.localeCompare(b.language));
      const byCountry = buildGeoByCountryCsv(results);
      const byLanguage = buildGeoByLanguageCsv(rendered);
      setGeoReady({ byCountry, byLanguage });
      download('geo-backgrounds-by-country.csv', byCountry);
      await sleep(400); // stagger the second download so both files save
      download('geo-backgrounds-by-language.csv', byLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geo export failed');
    } finally {
      setRunning(false);
      setStopping(false);
    }
  }

  const bookOptions = books.map((b) => ({ value: b.id, label: b.name }));

  return (
    <SpaceShell userEmail={userEmail}>
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">Bulk Export</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-muted">
          Render a branded asset for every Bible version of the selected verse, upload each to your
          chosen destination, and download the CSVs. Geo backgrounds are a separate download.
        </p>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div>
              <FieldLabel>Verse reference</FieldLabel>
          <SearchableSelect
            value={bookId}
            onChange={(v) => {
              setBookId(v);
              setChapter(1);
              setFromVerse(1);
              setToVerse(1);
            }}
            options={bookOptions}
            placeholder={books.length ? 'Select a book' : 'Loading books…'}
          />
          <div className="mt-3 flex gap-3">
            <Stepper label="Chapter" value={chapter} min={1} max={maxChapter} onChange={setChapter} />
            <Stepper
              label="From verse"
              value={fromVerse}
              min={1}
              max={176}
              onChange={(v) => {
                setFromVerse(v);
                if (v > toVerse) setToVerse(v);
              }}
            />
            <Stepper
              label="To verse"
              value={toVerse}
              min={fromVerse}
              max={176}
              onChange={setToVerse}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Logo style</FieldLabel>
            <Select
              value={logoStyle}
              onChange={(v) => setLogoStyle(v)}
              options={[
                { value: 'icon-only' as LogoStyle, label: 'App icon' },
                { value: 'logo-light' as LogoStyle, label: 'Lockup (light)' },
                { value: 'logo-dark' as LogoStyle, label: 'Lockup (dark)' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Aspect</FieldLabel>
            <Select
              value={aspect}
              onChange={(v) => setAspect(v)}
              options={[
                { value: '1:1' as AspectRatio, label: 'Square 1:1' },
                { value: '9:16' as AspectRatio, label: 'Portrait 9:16' },
                { value: '16:9' as AspectRatio, label: 'Landscape 16:9' },
                { value: '4:5' as AspectRatio, label: 'Portrait 4:5' },
              ]}
            />
          </div>
          <div>
            <Stepper
              label="Limit (0 = all)"
              value={limit}
              min={0}
              max={5000}
              onChange={setLimit}
            />
          </div>
        </div>

        <div className="mt-6">
          <FieldLabel>Background</FieldLabel>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setLibView('unsplash');
                setLibOpen(true);
              }}
            >
              Browse image library
            </Button>
            {(studio.imageFile || studio.sharedBg?.kind === 'image') && (
              <span className="flex items-center gap-2 text-[13px] text-ink">
                {studio.imageFile ? 'Uploaded image selected' : 'Library image selected'}
                <button
                  type="button"
                  className="text-faint underline"
                  onClick={() => {
                    studio.setImageFile(null);
                    studio.clearSharedBg();
                  }}
                >
                  clear
                </button>
              </span>
            )}
          </div>
          <GradientPicker studio={studio} />
          <p className="mt-1 text-[12px] text-faint">
            A chosen image applies to every version; otherwise the gradient/color is used.
          </p>
        </div>

        <div className="mt-6 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Export</FieldLabel>
            <Select
              value={exportType}
              onChange={(v) => setExportType(v)}
              options={[
                { value: 'versions', label: 'Language backgrounds' },
                { value: 'geo', label: 'Geo backgrounds' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Destination</FieldLabel>
            <Select
              value={destination}
              onChange={(v) => setDestination(v)}
              options={DESTINATIONS}
            />
            {destination === 'air' && (
              <p className="mt-2 text-[12px] leading-snug text-brand">
                Heads up: CDN Links aren’t enabled on the AIR workspace, so links fall back to
                imgix preview URLs that 404 for a few seconds while each asset processes. Use
                AWS S3 or Braze for stable links, or enable CDN Links in AIR.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={exportType === 'geo' ? runGeo : runVersions}
            disabled={running}
          >
            {running
              ? 'Working…'
              : exportType === 'geo'
                ? 'Export geo backgrounds'
                : limit > 0
                  ? `Export ${limit} versions`
                  : 'Export all versions'}
          </Button>
          {running && (
            <Button variant="secondary" onClick={requestStop} disabled={stopping}>
              {stopping ? 'Stopping…' : 'Stop'}
            </Button>
          )}
        </div>

        {progress && (
          <p className="mt-4 text-[13px] text-muted">
            {progress.done}/{progress.total} rendered · {progress.failed} failed
          </p>
        )}
        {failReasons.length > 0 && (
          <div className="mt-2 max-w-2xl break-words text-[13px] text-brand">
            <div>Failures ({failReasons.length} shown):</div>
            <ul className="list-disc pl-5">
              {failReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {rows && (
          <div className="mt-2 flex items-center gap-3 text-[13px]">
            <span className="text-ink">
              {rows.filter((r) => r.air_cdn_link).length}/{rows.length} exported with links.
            </span>
            <button
              className="underline"
              onClick={() => download('versions.csv', buildVersionsCsv(rows))}
            >
              Re-download versions.csv
            </button>
          </div>
        )}
        {geoReady && (
          <div className="mt-2 flex flex-col gap-1 text-[13px]">
            <button
              className="underline"
              onClick={() => download('geo-backgrounds-by-country.csv', geoReady.byCountry)}
            >
              Re-download geo-backgrounds-by-country.csv
            </button>
            <button
              className="underline"
              onClick={() => download('geo-backgrounds-by-language.csv', geoReady.byLanguage)}
            >
              Re-download geo-backgrounds-by-language.csv
            </button>
          </div>
        )}
            {error && <p className="mt-4 text-[13px] text-brand">{error}</p>}
          </div>

          {/* Live preview of the final output (English NIV), mirroring the ad layout. */}
          <div className="lg:sticky lg:top-6">
            <FieldLabel>Preview · English (NIV)</FieldLabel>
            <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-panel">
              {previewUrl ? (
                <img src={previewUrl} alt="English preview" className="block w-full" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-[13px] text-faint">
                  {previewLoading ? 'Rendering…' : 'Preview will appear here'}
                </div>
              )}
            </div>
            <p className="mt-2 text-[12px] text-faint">
              Shows how each version will look with the current verse, logo, aspect, and background.
              {previewLoading && previewUrl ? ' Updating…' : ''}
            </p>
          </div>
        </div>
      </div>
      <LibraryModal
        studio={studio}
        open={libOpen}
        view={libView}
        setView={setLibView}
        onClose={() => setLibOpen(false)}
      />
    </SpaceShell>
  );
}
