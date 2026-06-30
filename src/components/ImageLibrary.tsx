import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  deleteSharedAsset,
  listSharedAssets,
  uploadSharedAsset,
  type SharedAsset,
} from '../lib/library';
import { Play, Spinner, UploadCloud, XMark } from './icons';
import { Button, Segmented } from './ui';

type Studio = ReturnType<typeof useStudio>;
type KindFilter = 'all' | 'image' | 'video';

// Lazy-mount the <video> only once its cell scrolls near the viewport, so a long
// library streams in top-first (one batch ahead via rootMargin) instead of
// fetching every video's metadata at once. Browser/CDN cache handles re-views.
function LazyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return (
    <div ref={ref} className="h-full w-full">
      {visible ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full animate-pulse-soft bg-line-soft" />
      )}
    </div>
  );
}

// Right-panel browser for the team-shared background library (images + videos).
// Picking an asset sets it as the background and returns to the preview (onPicked).
export function ImageLibrary({
  studio,
  onPicked,
}: {
  studio: Studio;
  onPicked?: () => void;
}) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KindFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    listSharedAssets()
      .then((all) => setAssets(all))
      .catch(() => setError('Could not load the background library'))
      .finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadSharedAsset(file);
      setAssets((prev) => [asset, ...prev]);
      studio.selectSharedAsset(asset);
      onPicked?.();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(asset: SharedAsset) {
    if (!window.confirm(`Remove “${asset.name}” from the shared library? This affects everyone.`)) {
      return;
    }
    setRemovingId(asset.id);
    setError(null);
    try {
      await deleteSharedAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      if (studio.sharedBg?.url === asset.fileUrl) studio.clearSharedBg();
    } catch {
      setError('Could not remove the asset');
    } finally {
      setRemovingId(null);
    }
  }

  const selected = studio.sharedBg;
  const imageCount = assets.filter((a) => a.kind === 'image').length;
  const videoCount = assets.filter((a) => a.kind === 'video').length;
  const visible = filter === 'all' ? assets : assets.filter((a) => a.kind === filter);

  return (
    <div className="scroll-slim h-full overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold text-ink">Background library</h2>
        <span className="text-[12px] font-medium text-faint">Reusable team backgrounds</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />

      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mb-4"
      >
        {uploading ? <Spinner className="text-muted" /> : <UploadCloud />}
        {uploading ? 'Uploading…' : 'Add an image (JPG / PNG)'}
      </Button>

      {error && <p className="mb-3 text-[13px] text-brand">{error}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}

      {!loading && assets.length === 0 && (
        <p className="text-[14px] text-faint">Nothing here yet — add an image above.</p>
      )}

      {assets.length > 0 && (
        <div className="mb-4 max-w-[360px]">
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as KindFilter)}
            options={[
              { value: 'all', label: `All (${assets.length})` },
              { value: 'video', label: `Videos (${videoCount})` },
              { value: 'image', label: `Images (${imageCount})` },
            ]}
          />
        </div>
      )}

      {assets.length > 0 && visible.length === 0 && (
        <p className="text-[14px] text-faint">No {filter}s in the library.</p>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((a) => {
            const active = selected?.url === a.fileUrl;
            const removing = removingId === a.id;
            const isVideo = a.kind === 'video';
            return (
              <div
                key={a.id}
                className={`group relative aspect-square overflow-hidden rounded-xl border bg-black transition ${
                  active ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-faint'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    studio.selectSharedAsset(a);
                    onPicked?.();
                  }}
                  title={a.name}
                  className="block h-full w-full"
                >
                  {isVideo ? (
                    <LazyVideo src={a.fileUrl} />
                  ) : (
                    <img
                      src={a.fileUrl}
                      alt={a.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                {isVideo && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white"
                  >
                    <Play width={14} height={14} />
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  title="Remove from library"
                  onClick={() => onRemove(a)}
                  disabled={removing}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                >
                  {removing ? <Spinner className="text-white" /> : <XMark width={14} height={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
