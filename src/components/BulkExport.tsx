'use client';

import { useEffect, useMemo, useState } from 'react';
import { SpaceShell } from './SpaceShell';
import { Button, FieldLabel, Select, SearchableSelect, Stepper } from './ui';
import { ASPECT_DIMENSIONS, type AspectRatio } from '../config';
import type { LogoStyle } from '../lib/iconCatalog';
import { renderImage } from '../lib/render';
import { YouVersionInternalProvider, loadBibleManifest } from '../lib/bible/internalProvider';
import type { Book } from '../lib/bible';
import { uploadImageToAir } from '../lib/export/airClient';
import { uploadImageToAws } from '../lib/export/awsClient';
import { s3KeyForVersion } from '../lib/export/awsPath';
import { runVersionExport, type ExportVersion } from '../lib/export/versionExport';
import { prioritizeVersions, DEFAULT_PRIORITY_CODES } from '../lib/export/versionOrder';
import type { VersionExportRow } from '../lib/export/types';
import { buildVersionsCsv, buildGeoByCountryCsv, buildGeoByLanguageCsv } from '../lib/export/csv';
import { LANGUAGE_COUNTRY } from '../lib/export/languageCountry';
import { planGeoQueries, buildGeoResults, type RawGeoPhoto } from '../lib/export/geoBackgrounds';

// Populate the book dropdown from a widely-available version (NIV).
const BOOK_LIST_VERSION = '111';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchCountryPhotos(country: string, capital: string): Promise<RawGeoPhoto[]> {
  const out: RawGeoPhoto[] = [];
  for (const query of planGeoQueries({ country, capital })) {
    const res = await fetch(
      `/api/unsplash/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: { photos?: RawGeoPhoto[] } };
    for (const p of json.data?.photos ?? []) out.push(p);
  }
  return out;
}

export function BulkExport({ userEmail }: { userEmail?: string | null }) {
  const provider = useMemo(() => new YouVersionInternalProvider(), []);
  const [logoStyle, setLogoStyle] = useState<LogoStyle>('logo-light');
  const [aspect, setAspect] = useState<AspectRatio>('1:1');

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    provider
      .listBooks(BOOK_LIST_VERSION)
      .then(setBooks)
      .catch(() => setBooks([]));
  }, [provider]);

  const currentBook = books.find((b) => b.id === bookId);
  const maxChapter = currentBook?.chapters ?? 150;

  async function runVersions(target: 'air' | 'aws') {
    setRunning(true);
    setError(null);
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

      const uploadImage =
        target === 'aws'
          ? (blob: Blob, fileName: string) => {
              const id = fileName.replace(/\.[^.]+$/, '');
              return uploadImageToAws(blob, s3KeyForVersion(reference, id, 'jpg'));
            }
          : uploadImageToAir;

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
          gradientId: 'ocean',
          concurrency: 8,
          onProgress: setProgress,
          onError: (versionId, err) =>
            console.warn(`[bulk-export] version ${versionId} failed:`, err),
        },
      );
      setRows(result);
      download('versions.csv', buildVersionsCsv(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setRunning(false);
    }
  }

  async function runGeo() {
    setRunning(true);
    setError(null);
    try {
      const manifest = await loadBibleManifest();
      const languages = manifest.languages
        .filter((l) => LANGUAGE_COUNTRY[l.code])
        .map((l) => ({ code: l.code, name: l.name }));
      const countries = new Map<string, string>();
      for (const l of languages) {
        const info = LANGUAGE_COUNTRY[l.code];
        countries.set(info.country, info.capital);
      }
      const photosByCountry = new Map<string, RawGeoPhoto[]>();
      for (const [country, capital] of countries) {
        photosByCountry.set(country, await fetchCountryPhotos(country, capital));
      }
      const results = buildGeoResults(languages, photosByCountry, { maxImages: 3 });
      const byCountry = buildGeoByCountryCsv(results);
      const byLanguage = buildGeoByLanguageCsv(results);
      setGeoReady({ byCountry, byLanguage });
      download('geo-backgrounds-by-country.csv', byCountry);
      download('geo-backgrounds-by-language.csv', byLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geo export failed');
    } finally {
      setRunning(false);
    }
  }

  const bookOptions = books.map((b) => ({ value: b.id, label: b.name }));

  return (
    <SpaceShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-extrabold text-ink">Bulk Export</h1>
        <p className="mt-2 text-[14px] text-muted">
          Render a branded asset for every Bible version of the selected verse, upload each to AIR,
          and download the CSVs. Geo backgrounds are a separate download.
        </p>

        <div className="mt-6">
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

        <div className="mt-6 grid grid-cols-3 gap-4">
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

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => runVersions('aws')} disabled={running}>
            {running ? 'Working…' : limit > 0 ? `Push ${limit} to AWS` : 'Push all to AWS'}
          </Button>
          <Button variant="secondary" onClick={() => runVersions('air')} disabled={running}>
            {limit > 0 ? `Export ${limit} to AIR` : 'Export all to AIR'}
          </Button>
          <Button variant="secondary" onClick={runGeo} disabled={running}>
            Export geo backgrounds
          </Button>
        </div>

        {progress && (
          <p className="mt-4 text-[13px] text-muted">
            {progress.done}/{progress.total} rendered · {progress.failed} failed
          </p>
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
    </SpaceShell>
  );
}
