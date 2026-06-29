'use client';

import { useEffect, useState } from 'react';
import { config } from './config';
import { InputPanel } from './components/InputPanel';
import { RightPanel, type RightView } from './components/RightPanel';
import { LibraryDrawer } from './components/LibraryDrawer';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { PanelResizer } from './components/PanelResizer';
import { useStudio } from './lib/useStudio';
import { resolveLogoFile } from './lib/logoAssets';
import { DEFAULT_PANEL_WIDTH, readStoredWidth, writeStoredWidth } from './lib/panelLayout';

const STATUS: Record<string, { label: string; dot: string }> = {
  idle: { label: 'Ready to generate', dot: 'bg-faint' },
  running: { label: 'Rendering…', dot: 'bg-brand animate-pulse' },
  done: { label: 'Render complete', dot: 'bg-emerald-500' },
  error: { label: 'Something went wrong', dot: 'bg-brand' },
};

export default function App({
  userEmail,
  space = 'ads',
}: {
  userEmail?: string | null;
  space?: 'ads' | 'social' | 'product';
}) {
  const studio = useStudio();
  const statusKey = studio.isRendering
    ? 'running'
    : (studio.selectedJob?.status ?? 'idle');
  const status = STATUS[statusKey] ?? STATUS.idle;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [rightView, setRightView] = useState<RightView>('output');
  // Start at the deterministic default so SSR and first client render match,
  // then adopt any stored width after mount.
  const [leftWidth, setLeftWidth] = useState(DEFAULT_PANEL_WIDTH);
  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) setLeftWidth(stored);
  }, []);

  const langIcon = resolveLogoFile('icon-only', studio.languageCode);
  const headerLogo = langIcon
    ? `${config.brand.logoBaseDir}/icon-only/${langIcon}`
    : config.brand.logoPath;

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-line px-7 py-3.5">
        <div className="flex items-center gap-3">
          <img src={headerLogo} alt="" className="h-9 w-9 rounded-[11px]" />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight text-ink">
              {config.brand.name}
            </div>
            <div className="text-[12px] font-medium text-muted">{config.brand.tagline}</div>
          </div>
        </div>
        <SpaceSwitcher />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
          >
            Library
          </button>
          <div className="flex items-center gap-2 rounded-full bg-panel px-3.5 py-1.5">
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            <span className="text-[13px] font-semibold text-muted">{status.label}</span>
          </div>
          {userEmail && (
            <div className="flex items-center gap-2.5 border-l border-line pl-3">
              <span className="hidden text-[13px] font-medium text-muted sm:inline">
                {userEmail}
              </span>
              <a
                href="/auth/signout"
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Two-panel body */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--left-col)_1fr]"
        style={{ '--left-col': `${leftWidth}px` } as React.CSSProperties}
      >
        <aside className="relative min-h-0 border-r border-line bg-surface">
          <InputPanel
            studio={studio}
            space={space}
            onBrowse={(v) => setRightView(v)}
          />
          <PanelResizer width={leftWidth} onResize={setLeftWidth} onCommit={writeStoredWidth} />
        </aside>
        <main className="min-h-0 bg-panel">
          <RightPanel
            studio={studio}
            space={space}
            view={rightView}
            setView={setRightView}
          />
        </main>
      </div>

      <LibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
