'use client';

import type { ShellProps } from './index';
import { OutputPanel } from '../OutputPanel';
import {
  AudioFields,
  BackgroundFields,
  BrandingFields,
  GenerateFooter,
  OutputFields,
  VerseFields,
  showAudioFields,
  showBrandingFields,
} from '../studio/controls';

function Group({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-6 py-6 last:border-b-0">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-[12px] font-bold tabular-nums text-brand">{n}</span>
        <h4 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink">{title}</h4>
      </div>
      {children}
    </section>
  );
}

export function EverlightShell({ studio, space, settings, onBrowse }: ShellProps) {
  const groups: { n: string; title: string; node: React.ReactNode }[] = [
    { n: '01', title: 'Verse', node: <VerseFields studio={studio} /> },
    {
      n: '02',
      title: 'Background',
      node: <BackgroundFields studio={studio} onBrowse={onBrowse} />,
    },
    { n: '03', title: 'Output', node: <OutputFields studio={studio} space={space} /> },
  ];
  let n = 4;
  if (showAudioFields(studio, settings)) {
    groups.push({ n: `0${n++}`, title: 'Audio', node: <AudioFields studio={studio} settings={settings} /> });
  }
  if (showBrandingFields(studio, settings)) {
    groups.push({ n: `0${n++}`, title: 'Branding', node: <BrandingFields studio={studio} /> });
  }

  return (
    <div className="grid h-full grid-cols-[1fr_400px]">
      {/* Stage */}
      <div className="min-h-0 bg-panel">
        <OutputPanel studio={studio} space={space} />
      </div>

      {/* Quiet inspector */}
      <aside className="flex min-h-0 flex-col border-l border-line bg-surface">
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
          {groups.map((g) => (
            <Group key={g.n} n={g.n} title={g.title}>
              {g.node}
            </Group>
          ))}
        </div>
        <GenerateFooter studio={studio} className="border-t border-line bg-surface px-6 pb-5 pt-4" />
      </aside>
    </div>
  );
}
