import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  deleteSharedAsset,
  listSharedAssets,
  uploadSharedAsset,
  type SharedAsset,
} from '../lib/library';
import { Spinner, UploadCloud, XMark } from './icons';
import { Button } from './ui';

type Studio = ReturnType<typeof useStudio>;

// Right-panel browser for the team-shared image library. Picking an image sets
// it as the background and returns to the preview (onPicked).
export function ImageLibrary({
  studio,
  onPicked,
}: {
  studio: Studio;
  onPicked?: () => void;
}) {
  const [images, setImages] = useState<SharedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    listSharedAssets()
      .then((all) => setImages(all.filter((a) => a.kind === 'image')))
      .catch(() => setError('Could not load the image library'))
      .finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadSharedAsset(file);
      setImages((prev) => [asset, ...prev]);
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
      setImages((prev) => prev.filter((a) => a.id !== asset.id));
      if (studio.sharedBg?.url === asset.fileUrl) studio.clearSharedBg();
    } catch {
      setError('Could not remove the image');
    } finally {
      setRemovingId(null);
    }
  }

  const selected = studio.sharedBg;

  return (
    <div className="scroll-slim h-full overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold text-ink">Image library</h2>
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

      {!loading && images.length === 0 && (
        <p className="text-[14px] text-faint">No images yet — add one above.</p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((a) => {
            const active = selected?.url === a.fileUrl;
            const removing = removingId === a.id;
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
                  <img src={a.fileUrl} alt={a.name} className="h-full w-full object-cover" />
                </button>
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
