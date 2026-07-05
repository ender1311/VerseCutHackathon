'use client';

import { useEffect, useRef, useState } from 'react';

// Lazy-mount the <video> only once its cell scrolls near the viewport, so a long
// library streams in top-first (one batch ahead via rootMargin) instead of
// fetching every video's metadata at once. Browser/CDN cache handles re-views.
export function LazyVideo({
  src,
  controls = false,
  className = 'h-full w-full object-cover',
}: {
  src: string;
  /** Show native playback controls (makes the tile viewable + playable). */
  controls?: boolean;
  className?: string;
}) {
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
  // Append a media fragment so browsers seek to ~first frame and paint it as a
  // preview, instead of showing a black tile before playback. Only for http(s)
  // sources — `#t=` on a `blob:` URL isn't reliably honored and can break the
  // object-URL lookup. Skip if the src already has a fragment.
  const displaySrc =
    /^https?:/i.test(src) && !src.includes('#') ? `${src}#t=0.1` : src;
  return (
    <div ref={ref} className="h-full w-full">
      {visible ? (
        <video
          src={displaySrc}
          muted
          playsInline
          controls={controls}
          preload="metadata"
          className={className}
        />
      ) : (
        <div className="h-full w-full animate-pulse-soft bg-line-soft" />
      )}
    </div>
  );
}
