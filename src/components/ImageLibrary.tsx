import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  deleteSharedAsset,
  listSharedAssets,
  uploadSharedAsset,
  type SharedAsset,
} from '../lib/library';
import { Play, Spinner, UploadCloud, XMark } from './icons';
import { Button, Segmented, Select } from './ui';
import { LazyVideo } from './LazyVideo';

type Studio = ReturnType<typeof useStudio>;
type LibrarySource = 'youversion' | 'unsplash';
type CatFilter = 'all' | 'prerendered_bg' | 'prerendered' | 'kids';
type OrientFilter = 'all' | 'portrait' | 'landscape';
type LangFilter = 'all' | 'en' | 'es' | 'pt' | 'fr';


// Right-panel browser for the team-shared library, scoped by tab:
// YouVersion (verse backgrounds, grouped by language + category/orientation
// filters), Unsplash (photo backgrounds), and the Video library (kind=video).
export function ImageLibrary({
  studio,
  kind = 'image',
  source,
  onPicked,
}: {
  studio: Studio;
  kind?: 'image' | 'video';
  source?: LibrarySource;
  onPicked?: () => void;
}) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cat, setCat] = useState<CatFilter>('all');
  const [orient, setOrient] = useState<OrientFilter>('all');
  const [lang, setLang] = useState<LangFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listSharedAssets()
      .then((all) => active && setAssets(all))
      .catch(() => active && setError('Could not load the library'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

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
  const isYouVersion = source === 'youversion';
  const canUpload = source === 'unsplash';

  let visible = assets.filter((a) => a.kind === kind && (!source || a.source === source));
  if (isYouVersion) {
    if (lang !== 'all') visible = visible.filter((a) => (a.language || 'other') === lang);
    if (cat === 'kids') visible = visible.filter((a) => a.audience === 'kids');
    else if (cat !== 'all') visible = visible.filter((a) => a.category === cat);
    if (orient !== 'all') visible = visible.filter((a) => a.orientation === orient);
  }

  const heading = isYouVersion
    ? 'YouVersion'
    : source === 'unsplash'
      ? 'Unsplash'
      : 'Video library';
  const subtitle = isYouVersion
    ? 'Bible App verse backgrounds'
    : source === 'unsplash'
      ? 'Reusable photo backgrounds'
      : 'Reusable videos';

  function card(a: SharedAsset) {
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
  }

  const grid = (list: SharedAsset[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{list.map(card)}</div>
  );

  return (
    <div className="scroll-slim h-full overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold text-ink">{heading}</h2>
        <span className="text-[12px] font-medium text-faint">{subtitle}</span>
      </div>

      {canUpload && (
        <>
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
        </>
      )}

      {isYouVersion && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[150px] flex-1">
              <Select
                value={lang}
                onChange={(v) => setLang(v as LangFilter)}
                options={[
                  { value: 'all', label: 'All languages' },
                  { value: 'en', label: 'English' },
                  { value: 'es', label: 'Spanish' },
                  { value: 'pt', label: 'Portuguese' },
                  { value: 'fr', label: 'French' },
                ]}
              />
            </div>
            <div className="min-w-[150px] flex-1">
              <Select
                value={cat}
                onChange={(v) => setCat(v as CatFilter)}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'prerendered_bg', label: 'Backgrounds' },
                  { value: 'prerendered', label: 'Verse images' },
                  { value: 'kids', label: 'Kids' },
                ]}
              />
            </div>
          </div>
          <Segmented
            value={orient}
            onChange={(v) => setOrient(v as OrientFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
        </div>
      )}

      {error && <p className="mb-3 text-[13px] text-brand">{error}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <p className="text-[14px] text-faint">
          {kind === 'video'
            ? 'No videos in the library yet.'
            : canUpload
              ? 'Nothing here yet — add an image above.'
              : 'No matching backgrounds.'}
        </p>
      )}

      {visible.length > 0 && (
        <>
          {isYouVersion && (
            <p className="mb-3 text-[12px] font-medium text-faint">
              {visible.length} {visible.length === 1 ? 'image' : 'images'}
            </p>
          )}
          {grid(visible)}
        </>
      )}
    </div>
  );
}
