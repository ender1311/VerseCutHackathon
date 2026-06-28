import { useEffect, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import { loadManifest, listImportedVideos, type ImportedVideoEntry, type ManifestEntry } from '../lib/videoLibrary';
import { Check, Spinner, VideoIcon, XMark } from './icons';
import { Button, FieldLabel } from './ui';

type Studio = ReturnType<typeof useStudio>;

export function VideoLibrary({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
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
    listImportedVideos()
      .then(setImports)
      .catch(() => {});
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

  const selected = studio.libraryVideo;

  return (
    <div>
      <FieldLabel hint="YouVersion · by date">Video library</FieldLabel>

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <VideoIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">
              {selected.entry.title}
            </div>
            <div className="text-[12px] text-faint">
              {'references' in selected.entry && selected.entry.references?.length
                ? `${selected.entry.references.join(', ')} · `
                : ''}
              {selected.entry.language.toUpperCase()}
            </div>
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
            <VideoIcon />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink">Browse YouVersion videos</div>
            <div className="text-[12px] text-faint">Pick a Guided Scripture video by date</div>
          </div>
        </button>
      )}

      {open && !selected && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="mb-1.5 text-[12px] font-medium text-muted">Date</div>
              <input
                type="date"
                value={date}
                list="video-dates"
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-brand"
              />
              <datalist id="video-dates">
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
              {dates.slice(-6).map((d) => (
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

          {error && <p className="mt-2 text-[12px] text-brand">{error}</p>}

          {results && (
            <div className="scroll-slim mt-3 max-h-56 space-y-1 overflow-y-auto">
              {results.length === 0 && (
                <p className="py-2 text-[13px] text-muted">No videos for this date.</p>
              )}
              {results.map((v) => (
                <button
                  key={`${v.videoId}-${v.language}`}
                  type="button"
                  disabled={studio.libraryBusy}
                  onClick={() => studio.selectLibraryVideo(v)}
                  className="flex w-full items-center gap-2 rounded-lg border border-line-soft p-2 text-left transition hover:border-line hover:bg-line-soft/50 disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{v.title}</div>
                    <div className="text-[11px] text-faint">
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
            <div className="mt-4 border-t border-line-soft pt-3">
              <div className="mb-2 text-[12px] font-medium text-muted">Imported videos</div>
              <div className="scroll-slim max-h-40 space-y-1 overflow-y-auto">
                {imports.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={studio.libraryBusy}
                    onClick={() => studio.selectImportedVideo(v)}
                    className="flex w-full items-center gap-2 rounded-lg border border-line-soft p-2 text-left transition hover:border-line hover:bg-line-soft/50 disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{v.title}</div>
                      <div className="text-[11px] text-faint">
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
      )}
    </div>
  );
}
