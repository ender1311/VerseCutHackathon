import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  deleteSharedAsset,
  listSharedAssets,
  uploadSharedAsset,
  type SharedAsset,
} from '../lib/library';
import {
  searchUnsplashPhotos,
  trackUnsplashPhotoDownload,
} from '../lib/unsplash/client';
import type { UnsplashOrientation, UnsplashPhoto } from '../lib/unsplash/types';
import { GEO_LANDMARKS, DEFAULT_GEO_LANDMARK, getGeoLandmark } from '../lib/geo/landmarks';
import { isLandmarkPhotoSafe } from '../lib/geo/landmarkSafety';
import { Play, Spinner, UploadCloud, XMark } from './icons';
import { Button, Segmented, Select } from './ui';
import { LazyVideo } from './LazyVideo';

type Studio = ReturnType<typeof useStudio>;
type LibrarySource = 'youversion' | 'unsplash' | 'geo';
type CatFilter = 'all' | 'prerendered_bg' | 'prerendered' | 'kids';
type OrientFilter = 'all' | 'portrait' | 'landscape';
type LangFilter = 'all' | 'en' | 'es' | 'pt' | 'fr';
type UnsplashOrientFilter = 'all' | UnsplashOrientation;

const SEARCH_DEBOUNCE_MS = 350;

// Right-panel browser for the team-shared library, scoped by tab:
// YouVersion (verse backgrounds, grouped by language + category/orientation
// filters), Unsplash (live photo search + optional team uploads), and
// Videos (kind=video — shared/uploaded video backgrounds).
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

  // Unsplash live search state
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unsplashOrient, setUnsplashOrient] = useState<UnsplashOrientFilter>('all');
  const [unsplashPhotos, setUnsplashPhotos] = useState<UnsplashPhoto[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);
  const [unsplashTotal, setUnsplashTotal] = useState(0);

  // Geo tab: selected country → its curated landmark search term.
  const [geoCode, setGeoCode] = useState(DEFAULT_GEO_LANDMARK.code);

  const isYouVersion = source === 'youversion';
  const isUnsplash = source === 'unsplash';
  const isGeo = source === 'geo';
  const canUpload = isUnsplash;
  // Both Unsplash and Geo tabs query the Unsplash proxy; Geo forces the query to
  // the selected landmark and filters results to Christian-friendly landmarks.
  const usesUnsplash = isUnsplash || isGeo;
  const landmark = getGeoLandmark(geoCode);
  const effectiveQuery = isGeo ? landmark.term : searchQuery;

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

  // Debounce the Unsplash search box.
  useEffect(() => {
    if (!isUnsplash) return;
    const t = window.setTimeout(() => setSearchQuery(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchDraft, isUnsplash]);

  // Live Unsplash / Geo results (empty query → curated/latest list). Geo
  // over-fetches slightly since results are then filtered client-side.
  useEffect(() => {
    if (!usesUnsplash) return;
    let active = true;
    setUnsplashLoading(true);
    setUnsplashError(null);
    searchUnsplashPhotos({
      query: effectiveQuery || undefined,
      page: 1,
      perPage: isGeo ? 30 : 24,
      orientation: unsplashOrient,
    })
      .then((result) => {
        if (!active) return;
        setUnsplashPhotos(result.photos);
        setUnsplashTotal(result.total);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Unsplash search failed';
        setUnsplashError(msg);
        setUnsplashPhotos([]);
        setUnsplashTotal(0);
      })
      .finally(() => {
        if (active) setUnsplashLoading(false);
      });
    return () => {
      active = false;
    };
  }, [usesUnsplash, isGeo, effectiveQuery, unsplashOrient]);

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

  function pickUnsplash(photo: UnsplashPhoto) {
    const label =
      photo.description?.trim() ||
      `Unsplash · ${photo.user.name} · ${photo.id}`;
    studio.selectUnsplashPhoto({
      url: photo.urls.regular,
      label,
      attribution: {
        photographerName: photo.user.name,
        photographerUrl: photo.user.profileUrl,
        photoUrl: photo.links.html,
      },
    });
    // Guideline: trigger download tracking when the photo is selected for use.
    void trackUnsplashPhotoDownload(photo).catch(() => {
      /* non-blocking */
    });
    onPicked?.();
  }

  const selected = studio.sharedBg;

  let visible = assets.filter((a) => a.kind === kind && (!source || a.source === source));
  if (isYouVersion) {
    if (lang !== 'all') visible = visible.filter((a) => (a.language || 'other') === lang);
    if (cat === 'kids') visible = visible.filter((a) => a.audience === 'kids');
    else if (cat !== 'all') visible = visible.filter((a) => a.category === cat);
    if (orient !== 'all') visible = visible.filter((a) => a.orientation === orient);
  }

  // Team-library Unsplash seeds only when not actively searching.
  const teamUnsplash = isUnsplash && !searchQuery ? visible : [];

  // Geo results, filtered to Christian-friendly landmark imagery.
  const geoPhotos = isGeo
    ? unsplashPhotos.filter((p) => isLandmarkPhotoSafe(p.description, landmark.term))
    : [];

  const heading = isYouVersion
    ? 'YouVersion'
    : isUnsplash
      ? 'Unsplash'
      : isGeo
        ? 'Geo'
        : 'Videos';
  const subtitle = isYouVersion
    ? 'Bible App verse backgrounds'
    : isUnsplash
      ? 'Search millions of free photos'
      : isGeo
        ? 'Famous landmarks by country'
        : 'Shared video backgrounds';

  function assetCard(a: SharedAsset) {
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

  function unsplashCard(photo: UnsplashPhoto) {
    const active = selected?.url === photo.urls.regular;
    const alt = photo.description || `Photo by ${photo.user.name}`;
    return (
      <div
        key={photo.id}
        className={`group relative aspect-square overflow-hidden rounded-xl border bg-black transition ${
          active ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-faint'
        }`}
      >
        <button
          type="button"
          onClick={() => pickUnsplash(photo)}
          title={`${alt} — ${photo.user.name}`}
          className="block h-full w-full"
        >
          <img
            src={photo.urls.small}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </button>
        <a
          href={`${photo.user.profileUrl}?utm_source=versecut&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"
        >
          {photo.user.name}
        </a>
      </div>
    );
  }

  const grid = (list: SharedAsset[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{list.map(assetCard)}</div>
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

      {isUnsplash && (
        <div className="mb-4 flex flex-col gap-3">
          <label className="block">
            <span className="sr-only">Search Unsplash</span>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search Unsplash…"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-faint focus:ring-4 focus:ring-brand/15"
            />
          </label>
          <Segmented
            value={unsplashOrient}
            onChange={(v) => setUnsplashOrient(v as UnsplashOrientFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
              { value: 'squarish', label: 'Square' },
            ]}
          />
        </div>
      )}

      {isGeo && (
        <div className="mb-4 flex flex-col gap-3">
          <Select
            value={geoCode}
            onChange={(v) => setGeoCode(v)}
            options={GEO_LANDMARKS.map((l) => ({ value: l.code, label: l.country }))}
          />
          <Segmented
            value={unsplashOrient}
            onChange={(v) => setUnsplashOrient(v as UnsplashOrientFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
              { value: 'squarish', label: 'Square' },
            ]}
          />
        </div>
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

      {(error || unsplashError) && (
        <p className="mb-3 text-[13px] text-brand">{error || unsplashError}</p>
      )}

      {isUnsplash && (
        <>
          {unsplashLoading && (
            <div className="mb-3 flex items-center gap-2 text-[14px] text-muted">
              <Spinner className="text-muted" /> Searching…
            </div>
          )}
          {!unsplashLoading && unsplashPhotos.length === 0 && !unsplashError && (
            <p className="mb-3 text-[14px] text-faint">No photos found.</p>
          )}
          {unsplashPhotos.length > 0 && (
            <>
              <p className="mb-3 text-[12px] font-medium text-faint">
                {searchQuery
                  ? `${unsplashTotal.toLocaleString()} results`
                  : 'Popular on Unsplash'}
              </p>
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {unsplashPhotos.map(unsplashCard)}
              </div>
            </>
          )}
          {teamUnsplash.length > 0 && (
            <>
              <h3 className="mb-2 text-[14px] font-semibold text-ink">Team library</h3>
              <p className="mb-3 text-[12px] text-faint">
                Previously saved Unsplash-sourced backgrounds
              </p>
              {grid(teamUnsplash)}
            </>
          )}
        </>
      )}

      {isGeo && (
        <>
          {unsplashLoading && (
            <div className="mb-3 flex items-center gap-2 text-[14px] text-muted">
              <Spinner className="text-muted" /> Searching…
            </div>
          )}
          {!unsplashLoading && geoPhotos.length === 0 && !unsplashError && (
            <p className="mb-3 text-[14px] text-faint">No landmark photos found.</p>
          )}
          {geoPhotos.length > 0 && (
            <>
              <p className="mb-3 text-[12px] font-medium text-faint">
                {landmark.term} · {landmark.country}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {geoPhotos.map(unsplashCard)}
              </div>
            </>
          )}
        </>
      )}

      {!usesUnsplash && loading && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}

      {!usesUnsplash && !loading && visible.length === 0 && (
        <p className="text-[14px] text-faint">
          {kind === 'video' ? 'No shared videos yet. Upload one to get started.' : 'No matching backgrounds.'}
        </p>
      )}

      {!usesUnsplash && visible.length > 0 && (
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
