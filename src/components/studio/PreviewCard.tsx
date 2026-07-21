'use client';

import { useEffect, useState } from 'react';
import { resolveDraftBackground, type DraftBackground } from '../../lib/draftBackground';
import type { useStudio } from '../../lib/useStudio';

type Studio = ReturnType<typeof useStudio>;

/**
 * A fixed-aspect media frame. Tall/square formats size by height; 16:9 sizes by
 * width. The frame fills the available height of its (flex-constrained) parent
 * and never overflows it, with a hard cap on large viewports.
 */
export function PreviewFrame({
  aspect,
  safeArea,
  capPx = 720,
  children,
}: {
  aspect: string;
  safeArea?: boolean;
  /** Max height cap (px) for height-driven formats; raised in the side layout. */
  capPx?: number;
  children: React.ReactNode;
}) {
  const byHeight = aspect !== '16:9';
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
      style={{
        aspectRatio: aspect.replace(':', ' / '),
        height: byHeight ? '100%' : undefined,
        width: byHeight ? undefined : 'min(100%, 880px)',
        maxHeight: `min(100%, ${capPx}px)`,
        maxWidth: '100%',
      }}
    >
      {children}
      {safeArea && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-x-[6%] inset-y-[10%] rounded-lg border border-dashed border-white/45" />
          <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85">
            Safe area
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Resolve the live draft background (upload / library pick / shared asset),
 * managing object URLs for File sources. Mirrors OutputPanel's draft logic so
 * shells can render a live preview without a render job.
 */
export function useDraftBackground(studio: Studio): DraftBackground | null {
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!studio.imageFile) return;
    const url = URL.createObjectURL(studio.imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [studio.imageFile]);
  useEffect(() => {
    if (!studio.videoFile) return;
    const url = URL.createObjectURL(studio.videoFile);
    setVideoObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [studio.videoFile]);

  return resolveDraftBackground(
    {
      imageFile: studio.imageFile,
      videoFile: studio.videoFile,
      sharedBg: studio.sharedBg,
      libraryVideo: studio.libraryVideo,
    },
    {
      image: studio.imageFile ? imageObjectUrl : null,
      video: studio.videoFile ? videoObjectUrl : null,
    },
  );
}

/**
 * Compact live preview for aside surfaces (Guided / Templates shells). Shows the
 * finished render when a job is selected + done, otherwise the live draft
 * background, otherwise a quiet placeholder. Does NOT composite the verse — the
 * real overlay only exists in the rendered asset.
 */
export function PreviewCard({
  studio,
  safeArea,
  capPx = 560,
  className = '',
}: {
  studio: Studio;
  safeArea?: boolean;
  capPx?: number;
  className?: string;
}) {
  const { selectedJob } = studio;
  const aspect = selectedJob?.aspect ?? studio.aspect;
  const asset = selectedJob?.status === 'done' ? selectedJob.asset : null;
  const draftBg = useDraftBackground(studio);

  return (
    <div className={`flex min-h-0 items-center justify-center ${className}`}>
      <PreviewFrame aspect={aspect} safeArea={safeArea} capPx={capPx}>
        {asset ? (
          asset.kind === 'image' ? (
            <img src={asset.url} alt="Generated verse ad" className="h-full w-full object-contain" />
          ) : (
            <video
              src={asset.url}
              className="h-full w-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          )
        ) : draftBg ? (
          draftBg.kind === 'video' ? (
            <video
              key={draftBg.url}
              src={draftBg.url}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              key={draftBg.url}
              src={draftBg.url}
              alt={draftBg.label ?? 'Selected background'}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_30%,rgba(254,55,69,0.22),transparent_60%)]" />
          </div>
        )}
      </PreviewFrame>
    </div>
  );
}
