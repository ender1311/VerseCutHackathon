'use client';

import { useEffect, useState } from 'react';
import { LazyVideo } from './LazyVideo';
import { Spinner } from './icons';

type ProductVideo = {
  id: string;
  feature: string;
  title: string;
  length: string;
  lang: string;
  orientation: string;
  fileUrl: string;
};

export function ProductLibrary() {
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/product-videos')
      .then((r) => { if (!r.ok) throw new Error('request failed'); return r.json(); })
      .then((j) => setVideos(Array.isArray(j.data) ? j.data : []))
      .catch(() => setError('Could not load the product video library'))
      .finally(() => setLoading(false));
  }, []);

  const features = Array.from(new Set(videos.map((v) => v.feature)));

  return (
    <div>
      {loading && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}
      {error && <p className="text-[13px] text-brand">{error}</p>}
      {!loading && !error && videos.length === 0 && (
        <p className="text-[14px] text-faint">
          No published videos yet — build one locally and click &quot;Publish to library&quot;.
        </p>
      )}
      {features.map((feature) => (
        <div key={feature} className="mb-8">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">
            {feature}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos
              .filter((v) => v.feature === feature)
              .map((v) => (
                <div
                  key={v.id}
                  className="overflow-hidden rounded-xl border border-line bg-black"
                >
                  <div className={v.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'}>
                    <LazyVideo src={v.fileUrl} />
                  </div>
                  <div className="bg-surface px-2 py-1.5 text-[11px] font-medium text-muted">
                    {v.length} · {v.lang} · {v.orientation}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
