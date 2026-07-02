'use client';

import { useEffect, useState } from 'react';
import { PRODUCT_TEMPLATES } from '@/lib/productTemplates';
import { renderTemplate } from '@/lib/templateCompositor';

// Dev-only preview to verify the template renderer (Slice A). Renders each
// template with the placeholder screen slot. Slice C replaces this with the
// real gallery + editor.
export default function TemplatePreview() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        for (const t of PRODUCT_TEMPLATES) {
          const blob = await renderTemplate(t, {});
          if (!alive) return;
          setUrls((u) => ({ ...u, [t.id]: URL.createObjectURL(blob) }));
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'render failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-panel p-8">
      <h1 className="mb-6 text-[18px] font-bold text-ink">Template preview (dev)</h1>
      {error && <p className="mb-4 text-[13px] text-brand">{error}</p>}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {PRODUCT_TEMPLATES.map((t) => (
          <figure key={t.id}>
            <figcaption className="mb-2 text-[13px] font-semibold text-ink">{t.name}</figcaption>
            {urls[t.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[t.id]} alt={t.name} className="w-full rounded-xl border border-line" />
            ) : (
              <div className="aspect-[9/19] w-full animate-pulse rounded-xl bg-line-soft" />
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
