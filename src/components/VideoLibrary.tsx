import { useEffect, useId, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  loadManifest,
  listImportedVideos,
  type ImportedVideoEntry,
  type ManifestEntry,
} from '../lib/videoLibrary';
import { Check, Spinner, VideoIcon, XMark } from './icons';
import { Button } from './ui';

type Studio = ReturnType<typeof useStudio>;

// Right-panel browser for the YouVersion video library. Picking a video sets it
// as the background and returns to the preview (onPicked).
export function VideoLibrary({
  studio,
  onPicked,
}: {
  studio: Studio;
  onPicked?: () => void;
}) {
  const datalistId = useId();
  const [date, setDate] = useState('2026-06-26');
  const [dates, setDates] = useState<string[]>([]);
  const [results, setResults] = useState<ManifestEntry[] | null>(null);
  const [imports, setImports] = useState<ImportedVideoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest()
      .then((m) => {
        const ds = Object.keys(m.dates).sort();
        setDates(ds);
        if (ds.length) setDate((d) => (ds.includes(d) ? d : ds[ds.length - 1]));
      })
      .catch(() => {});
    listImportedVideos().then(setImports).catch(() => {});
  }, []);

  async function find() {
    setLoading(true);
    setError(null);
    try {
      setResults(await studio.browseVideos(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }

  async function pick(v: ManifestEntry) {
    await studio.selectLibraryVideo(v);
    onPicked?.();
  }
  async function pickImported(v: ImportedVideoEntry) {
    await studio.selectImportedVideo(v);
    onPicked?.();
  }

  const selected = studio.libraryVideo;

  return (
    <div className="scroll-slim h-full overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold text-ink">Video library</h2>
        <span className="text-[12px] font-medium text-faint">YouVersion · Guided Scripture by date</span>
      </div>

      {selected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <VideoIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">
              {selected.entry.title}
            </div>
            <div className="text-[12px] text-faint">Current background</div>
          </div>
          <button
            type="button"
            aria-label="Remove library video"
            onClick={studio.clearLibraryVideo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <div className="mb-1.5 text-[12px] font-medium text-muted">Date</div>
          <input
            type="date"
            value={date}
            list={datalistId}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-brand"
          />
          <datalist id={datalistId}>
            {dates.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <Button variant="dark" onClick={find} disabled={loading}>
          {loading ? <Spinner className="text-white" /> : null}
          Find
        </Button>
      </div>

      {dates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.slice(-8).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                d === date ? 'bg-brand/10 text-brand' : 'bg-line-soft text-muted hover:text-ink'
              }`}
            >
              {d.slice(5)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-brand">{error}</p>}

      {results && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {results.length === 0 && (
            <p className="py-2 text-[14px] text-muted">No videos for this date.</p>
          )}
          {results.map((v) => (
            <button
              key={`${v.videoId}-${v.language}`}
              type="button"
              disabled={studio.libraryBusy}
              onClick={() => pick(v)}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint hover:bg-line-soft/50 disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink">{v.title}</div>
                <div className="text-[12px] text-faint">
                  {v.references.join(', ')} · {v.language.toUpperCase()}
                  {v.organization ? ` · ${v.organization}` : ''}
                </div>
              </div>
              {studio.libraryBusy ? (
                <Spinner className="text-muted" />
              ) : (
                <span className="text-faint">
                  <Check />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {imports.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-2 text-[13px] font-semibold text-ink">Imported videos</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {imports.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={studio.libraryBusy}
                onClick={() => pickImported(v)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint hover:bg-line-soft/50 disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-ink">{v.title}</div>
                  <div className="text-[12px] text-faint">
                    YouTube · {v.language.toUpperCase()} · {v.runtime}s
                  </div>
                </div>
                {studio.libraryBusy ? (
                  <Spinner className="text-muted" />
                ) : (
                  <span className="text-faint">
                    <Check />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
