'use client';

import { useEffect, useRef, useState } from 'react';

// Lazy-mount the <video> only once its cell scrolls near the viewport, so a long
// library streams in top-first (one batch ahead via rootMargin) instead of
// fetching every video's metadata at once. Browser/CDN cache handles re-views.
export function LazyVideo({ src }: { src: string }) {
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
