'use client';

import { useState } from 'react';
import type { ShellProps } from './index';
import { XMark } from '../icons';
import { PreviewCard } from '../studio/PreviewCard';
import { GenerateFooter, VerseFields } from '../studio/controls';
import { TEMPLATES, applyTemplate, type TemplateBadge, type TemplatePreset } from '../../lib/templates';
import { resolveGradient } from '../../lib/gradients';

const FILTERS: { id: 'all' | TemplateBadge; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Story', label: 'Story' },
  { id: 'Post', label: 'Post' },
  { id: 'Email', label: 'Email' },
  { id: 'Ad', label: 'Ad' },
];

function swatch(id: string) {
  const g = resolveGradient(id);
  return `linear-gradient(150deg, ${g.from} 0%, ${g.via} 55%, ${g.to} 100%)`;
}

function TemplateThumb({ tpl }: { tpl: TemplatePreset }) {
  return (
    <div
      className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-xl p-4 text-white"
      style={{ backgroundImage: swatch(tpl.gradientId) }}
    >
      <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
        {tpl.badge}
      </span>
      <div className="font-serif text-[15px] leading-snug drop-shadow">{tpl.sampleVerse}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
        {tpl.sampleRef}
      </div>
    </div>
  );
}

export function TemplatesShell({ studio }: ShellProps) {
  const [filter, setFilter] = useState<'all' | TemplateBadge>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shown = filter === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.badge === filter);
  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? null;

  const pick = (tpl: TemplatePreset) => {
    applyTemplate(studio, tpl);
    setSelectedId(tpl.id);
  };

  return (
    <div className="flex h-full flex-col bg-[#efe7e5]">
      {/* Masthead */}
      <div className="shrink-0 px-11 pb-5 pt-8">
        <h1 className="text-[30px] font-extrabold tracking-tight text-ink">
          Start from a <span className="text-brand">template.</span>
        </h1>
        <p className="mt-1 max-w-xl text-[14px] text-muted">
          Pick a look that fits the placement — swap the verse and it’s ready to post.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                filter === f.id
                  ? 'bg-ink text-white'
                  : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_400px]">
        {/* Gallery */}
        <div className="scroll-slim @container min-h-0 overflow-y-auto px-11 pb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">Templates</h3>
            <span className="text-[12px] text-faint">{shown.length} designs</span>
          </div>
          <div className="grid grid-cols-2 gap-5 @[900px]:grid-cols-3">
            {shown.map((tpl) => {
              const on = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => pick(tpl)}
                  className="group text-left"
                >
                  <div
                    className={`rounded-2xl p-1 transition ${
                      on ? 'ring-2 ring-brand' : 'ring-1 ring-transparent group-hover:ring-line'
                    }`}
                  >
                    <TemplateThumb tpl={tpl} />
                  </div>
                  <div className="mt-2 px-1">
                    <div className="text-[14px] font-semibold text-ink">{tpl.name}</div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                      {tpl.badge} · {tpl.aspect}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inspector aside */}
        <aside className="flex min-h-0 flex-col border-l border-line bg-surface">
          {selected ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
                <h4 className="text-[15px] font-extrabold text-ink">{selected.name}</h4>
                <button
                  type="button"
                  aria-label="Deselect template"
                  onClick={() => setSelectedId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
                >
                  <XMark />
                </button>
              </div>
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-5">
                <PreviewCard studio={studio} className="mb-5 h-[300px]" capPx={300} />

                <div className="mb-5">
                  <div className="mb-2 text-[13px] font-semibold text-ink">Palette</div>
                  <div className="flex flex-wrap gap-2">
                    {studio.gradients.slice(0, 12).map((g) => {
                      const on = !studio.customColor && studio.gradientId === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          title={g.name}
                          aria-label={g.name}
                          aria-pressed={on}
                          onClick={() => studio.setGradientId(g.id)}
                          className={`h-8 w-8 rounded-lg border transition ${
                            on ? 'border-brand ring-2 ring-brand/40' : 'border-line hover:border-faint'
                          }`}
                          style={{ backgroundImage: swatch(g.id) }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mb-2 text-[13px] font-semibold text-ink">Verse &amp; text</div>
                <VerseFields studio={studio} />
              </div>
              <GenerateFooter studio={studio} className="border-t border-line bg-surface px-5 pb-5 pt-4" />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="text-[15px] font-semibold text-ink">Pick a template</div>
              <p className="max-w-[240px] text-[13px] text-muted">
                Choose a look on the left to preview it and customize the verse before you generate.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
