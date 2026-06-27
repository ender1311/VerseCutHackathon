'use client';

import { useState } from 'react';
import { config } from './config';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';
import { LibraryDrawer } from './components/LibraryDrawer';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { useStudio } from './lib/useStudio';
import { BIBLE_APP_ASSETS } from './lib/iconCatalog';

const STATUS: Record<string, { label: string; dot: string }> = {
  idle: { label: 'Ready to generate', dot: 'bg-faint' },
  running: { label: 'Generating…', dot: 'bg-brand animate-pulse' },
  done: { label: 'Render complete', dot: 'bg-emerald-500' },
  error: { label: 'Something went wrong', dot: 'bg-brand' },
};

export default function App({ userEmail }: { userEmail?: string | null }) {
  const studio = useStudio();
  const status = STATUS[studio.phase];
  const [libraryOpen, setLibraryOpen] = useState(false);

  const langIcon = BIBLE_APP_ASSETS['icon-only'][studio.languageCode];
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
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(420px,468px)_1fr]">
        <aside className="min-h-0 border-r border-line bg-surface">
          <InputPanel studio={studio} />
        </aside>
        <main className="min-h-0 bg-panel">
          <OutputPanel studio={studio} />
        </main>
      </div>

      <LibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
