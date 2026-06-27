import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import {
  listSharedAssets,
  uploadSharedAsset,
  type SharedAsset,
} from '../lib/library';
import { ImageIcon, Spinner, UploadCloud, VideoIcon, XMark } from './icons';
import { FieldLabel } from './ui';

type Studio = ReturnType<typeof useStudio>;

export function SharedBackgrounds({ studio }: { studio: Studio }) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    listSharedAssets()
      .then(setAssets)
      .catch(() => setError('Could not load shared backgrounds'))
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
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const selected = studio.sharedBg;

  return (
    <div>
      <FieldLabel hint="Team · reusable">Shared backgrounds</FieldLabel>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />

      {selected && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            {selected.kind === 'video' ? <VideoIcon /> : <ImageIcon />}
          </div>
          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {selected.label}
          </div>
          <button
            type="button"
            aria-label="Remove shared background"
            onClick={studio.clearSharedBg}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mb-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-line p-2.5 text-left transition hover:border-faint disabled:opacity-60"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
            {uploading ? <Spinner className="text-muted" /> : <UploadCloud />}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink">
              {uploading ? 'Uploading…' : 'Upload & share a background'}
            </div>
            <div className="text-[11px] text-faint">Image or video (MP4 / WEBM / MOV)</div>
          </div>
        </button>

        {error && <p className="mb-2 text-[12px] text-brand">{error}</p>}
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Spinner className="text-muted" /> Loading…
          </div>
        )}

        {!loading && assets.length === 0 && (
          <p className="text-[12px] text-faint">No shared backgrounds yet.</p>
        )}

        {assets.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {assets.map((a) => {
              const active = selected?.url === a.fileUrl;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => studio.selectSharedAsset(a)}
                  title={a.name}
                  className={`relative aspect-square overflow-hidden rounded-lg border bg-black transition ${
                    active ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-faint'
                  }`}
                >
                  {a.kind === 'video' ? (
                    <video src={a.fileUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={a.fileUrl} alt={a.name} className="h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
