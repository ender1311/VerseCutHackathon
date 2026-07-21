'use client';

import { useState } from 'react';
import type { ShellProps } from './index';
import { Download, ImageIcon, Pencil, Play, Settings, Spinner, VideoIcon } from '../icons';
import { PreviewCard } from '../studio/PreviewCard';
import {
  AudioFields,
  BackgroundFields,
  BrandingFields,
  OutputFields,
  VerseFields,
  showAudioFields,
  showBrandingFields,
} from '../studio/controls';

type ToolKey = 'verse' | 'background' | 'output' | 'audio' | 'branding';

export function EverdarkShell({ studio, space, settings, onBrowse }: ShellProps) {
  const [tool, setTool] = useState<ToolKey>('background');

  const tools: { key: ToolKey; label: string; icon: React.ReactNode }[] = [
    { key: 'verse', label: 'Verse', icon: <Pencil /> },
    { key: 'background', label: 'Media', icon: <ImageIcon /> },
    { key: 'output', label: 'Output', icon: <Settings /> },
  ];
  if (showAudioFields(studio, settings)) tools.push({ key: 'audio', label: 'Audio', icon: <VideoIcon /> });
  if (showBrandingFields(studio, settings)) tools.push({ key: 'branding', label: 'Brand', icon: <Play /> });

  // If the active tool was hidden (e.g. switched to image → audio gone), fall back.
  const activeTool = tools.some((t) => t.key === tool) ? tool : 'background';
  const activeLabel = tools.find((t) => t.key === activeTool)?.label ?? '';

  const asset = studio.selectedJob?.status === 'done' ? studio.selectedJob.asset : null;
  function download() {
    if (!asset) return;
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = `verse-ad.${asset.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="grid h-full grid-cols-[86px_340px_1fr] bg-[#0c0b0b] text-[#c9c5c5]">
      {/* Tool rail */}
      <nav className="flex flex-col items-center gap-1.5 border-r border-[#2b2828] bg-[#181616] py-4">
        {tools.map((t) => {
          const on = t.key === activeTool;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTool(t.key)}
              className={`flex h-[60px] w-[62px] flex-col items-center justify-center gap-1.5 rounded-xl text-[10.5px] font-semibold transition ${
                on ? 'bg-[#2b2828] text-white' : 'text-[#8a8686] hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Contextual panel (dark chrome, light property card) */}
      <div className="flex min-h-0 flex-col border-r border-[#2b2828] bg-[#141313]">
        <div className="shrink-0 px-5 pb-2 pt-4">
          <h4 className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">{activeLabel}</h4>
        </div>
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-surface p-4 text-ink">
            {activeTool === 'verse' && <VerseFields studio={studio} />}
            {activeTool === 'background' && <BackgroundFields studio={studio} onBrowse={onBrowse} />}
            {activeTool === 'output' && <OutputFields studio={studio} space={space} />}
            {activeTool === 'audio' && <AudioFields studio={studio} settings={settings} />}
            {activeTool === 'branding' && <BrandingFields studio={studio} />}
          </div>
        </div>
      </div>

      {/* Stage */}
      <div className="flex min-h-0 flex-col bg-[radial-gradient(120%_100%_at_50%_0%,#1a1818,#0c0b0b)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#2b2828] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8686]">
          <span>
            {studio.format === 'video' ? 'Video' : 'Image'} · {studio.aspect} ·{' '}
            {studio.format === 'video' ? `${studio.durationSec}s` : studio.imageFormat.toUpperCase()}
          </span>
          <span>Fit · 100%</span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <PreviewCard studio={studio} className="h-full w-full" capPx={640} />
        </div>

        {/* Honest bottom strip: length + render status + actions (not a scrubber) */}
        <div className="shrink-0 border-t border-[#2b2828] bg-[#181616] px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 font-semibold text-white">
              {studio.isRendering ? (
                <>
                  <Spinner /> Rendering…
                </>
              ) : asset ? (
                'Render complete'
              ) : (
                `Ready · ${studio.format === 'video' ? `${studio.durationSec}s clip` : 'still image'}`
              )}
            </span>
            <span className="text-[#8a8686]">Renders in your browser · ~{studio.estimateSec}s</span>
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[#2b2828]">
            <div
              className={`h-full rounded-full bg-brand ${studio.isRendering ? 'w-2/3 animate-pulse-soft' : asset ? 'w-full' : 'w-0'}`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={studio.generate}
              disabled={!studio.canGenerate}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {studio.isRendering ? <Spinner className="text-white" /> : <Play />}
              {studio.isRendering ? 'Queue another' : `Generate ${studio.format === 'video' ? 'video' : 'image'}`}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!asset}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#3a3636] px-4 text-[14px] font-semibold text-white transition hover:bg-[#2b2828] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download /> Export
            </button>
          </div>
          {studio.generateBlockedReason && (
            <p className="mt-2 text-center text-[12px] text-[#8a8686]">{studio.generateBlockedReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
