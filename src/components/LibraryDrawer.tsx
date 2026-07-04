import { useEffect, useMemo, useState } from 'react';
import { deleteMyAd, listMyAds, type SavedAd } from '../lib/library';
import { Download, Spinner, Trash, XMark } from './icons';
import { Select } from './ui';

type SortKey = 'newest' | 'oldest' | 'title';

export function LibraryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ads, setAds] = useState<SavedAd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [tag, setTag] = useState<string>('all');

  const allTags = useMemo(
    () => Array.from(new Set((ads ?? []).flatMap((a) => a.tags ?? []))).sort(),
    [ads],
  );
  const view = useMemo(() => {
    let list = [...(ads ?? [])];
    if (tag !== 'all') list = list.filter((a) => (a.tags ?? []).includes(tag));
    list.sort((a, b) => {
      if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
      const cmp = a.createdAt.localeCompare(b.createdAt);
      return sort === 'oldest' ? cmp : -cmp;
    });
    return list;
  }, [ads, tag, sort]);

  async function onRemove(ad: SavedAd) {
    if (!window.confirm(`Delete “${ad.reference ?? 'this ad'}” from your library?`)) return;
    setRemovingId(ad.id);
    try {
      await deleteMyAd(ad.id);
      setAds((prev) => (prev ? prev.filter((a) => a.id !== ad.id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setRemovingId(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    setAds(null);
    setError(null);
    listMyAds()
      .then((a) => {
        if (active) setAds(a);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[16px] font-extrabold text-ink">My library</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>

        {ads && ads.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-line px-6 py-3">
            <div className="min-w-[140px] flex-1">
              <Select
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'title', label: 'Title (A–Z)' },
                ]}
              />
            </div>
            {allTags.length > 0 && (
              <div className="min-w-[140px] flex-1">
                <Select
                  value={tag}
                  onChange={setTag}
                  options={[
                    { value: 'all', label: 'All tags' },
                    ...allTags.map((t) => ({ value: t, label: `#${t}` })),
                  ]}
                />
              </div>
            )}
          </div>
        )}

        <div className="scroll-slim flex-1 overflow-y-auto p-6">
          {!ads && !error && (
            <div className="flex items-center gap-2 text-[14px] text-muted">
              <Spinner className="text-muted" /> Loading…
            </div>
          )}
          {error && <p className="text-[14px] text-brand">{error}</p>}
          {ads && ads.length === 0 && (
            <p className="text-[14px] text-muted">
              No saved ads yet. Generate one and tap “Save to library”.
            </p>
          )}
          {ads && ads.length > 0 && view.length === 0 && (
            <p className="text-[14px] text-muted">No ads match this tag.</p>
          )}
          {view.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {view.map((ad) => (
                <div key={ad.id} className="overflow-hidden rounded-xl border border-line">
                  <div className="aspect-square bg-black">
                    {ad.format === 'video' ? (
                      <video src={ad.fileUrl} className="h-full w-full object-contain" muted loop />
                    ) : (
                      <img src={ad.fileUrl} alt="" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-ink">
                        {ad.title || ad.reference || 'Verse ad'}
                      </div>
                      <div className="truncate text-[11px] text-faint">
                        {ad.versionAbbr ? `${ad.versionAbbr} · ` : ''}
                        {ad.aspect}
                      </div>
                      {ad.tags && ad.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ad.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-line-soft px-1.5 py-0.5 text-[10px] font-medium text-muted"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <a
                        href={ad.fileUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink"
                        aria-label="Download"
                      >
                        <Download />
                      </a>
                      <button
                        type="button"
                        onClick={() => onRemove(ad)}
                        disabled={removingId === ad.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-brand disabled:opacity-60"
                        aria-label="Delete"
                      >
                        {removingId === ad.id ? <Spinner className="text-muted" /> : <Trash />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
