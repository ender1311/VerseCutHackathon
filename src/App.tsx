'use client';

import { useEffect, useState } from 'react';
import { config } from './config';
import { InputPanel } from './components/InputPanel';
import { RightPanel, type RightView } from './components/RightPanel';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { PanelResizer } from './components/PanelResizer';
import { OutputPanel } from './components/OutputPanel';
import { GeneratedLibrary } from './components/GeneratedLibrary';
import { ImageLibrary } from './components/ImageLibrary';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileMenu } from './components/MobileMenu';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Segmented } from './components/ui';
import { Menu, Settings } from './components/icons';
import { type MobileView } from './lib/mobileNav';
import { useStudio } from './lib/useStudio';
import { DEFAULT_PANEL_WIDTH, readStoredWidth, writeStoredWidth } from './lib/panelLayout';
import {
  DEFAULT_APP_SETTINGS,
  readStoredAppSettings,
  toggleSetting,
  writeStoredAppSettings,
  type SettingKey,
  type VerseDefault,
} from './lib/appSettings';

type MobileLib = 'generated' | 'videos' | 'youversion' | 'unsplash';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  useEffect(() => {
    setSettings(readStoredAppSettings());
  }, []);
  const onToggleSetting = (key: SettingKey) =>
    setSettings((s) => {
      const next = toggleSetting(s, key);
      writeStoredAppSettings(next);
      return next;
    });
  const setVerseDefault = (vd: VerseDefault | null) =>
    setSettings((s) => {
      const next = { ...s, verseDefault: vd };
      writeStoredAppSettings(next);
      return next;
    });
  const [rightView, setRightView] = useState<RightView>('output');
  const [mobileView, setMobileView] = useState<MobileView>('edit');
  const [mobileLib, setMobileLib] = useState<MobileLib>('generated');
  const [menuOpen, setMenuOpen] = useState(false);
  // Start at the deterministic default so SSR and first client render match,
  // then adopt any stored width after mount.
  const [leftWidth, setLeftWidth] = useState(DEFAULT_PANEL_WIDTH);
  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) setLeftWidth(stored);
  }, []);

  const currentBook = studio.books.find((b) => b.id === studio.bookId);
  const currentVerse: VerseDefault = {
    book: studio.bookId,
    bookName: currentBook?.name ?? studio.bookId,
    chapter: studio.chapter,
    fromVerse: studio.fromVerse,
    toVerse: studio.toVerse,
  };

  return (
    <div className="flex h-dvh flex-col bg-surface">
      {/* Header */}
      <header className="shrink-0 border-b border-line">
        {/* Mobile / tablet header (<lg) */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 lg:hidden">
          <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <SpaceSwitcher />
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink"
          >
            <Menu />
          </button>
        </div>
        {/* Desktop header (≥lg) */}
        <div className="hidden items-center justify-between px-7 py-3.5 lg:flex">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-9 w-9 rounded-[11px]" />
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
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink"
            >
              <Settings />
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
        </div>
      </header>

      {/* Mobile / tablet body (<lg): one view at a time */}
      {/* NOTE: The mobile and desktop InputPanel below are intentionally separate instances (one hidden per breakpoint) sharing the same `studio`. */}
      <div className="min-h-0 flex-1 overflow-hidden lg:hidden">
        {mobileView === 'edit' && (
          <InputPanel
            studio={studio}
            space={space}
            settings={settings}
            onBrowse={(v) => {
              if (v === 'output') return;
              setMobileLib(v);
              setMobileView('library');
            }}
            onGenerate={() => {
              if (!studio.canGenerate) return;
              studio.generate();
              setMobileView('preview');
            }}
          />
        )}
        {mobileView === 'preview' && <OutputPanel studio={studio} space={space} />}
        {mobileView === 'library' && (
          <div className="flex h-full flex-col">
            <div className="shrink-0 px-4 pt-3">
              <Segmented
                value={mobileLib}
                onChange={(v) => setMobileLib(v as MobileLib)}
                options={[
                  { value: 'generated', label: 'Saved' },
                  { value: 'youversion', label: 'YouVersion' },
                  { value: 'unsplash', label: 'Unsplash' },
                  { value: 'videos', label: 'Videos' },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1">
              {mobileLib === 'generated' ? (
                <GeneratedLibrary />
              ) : mobileLib === 'videos' ? (
                <ImageLibrary studio={studio} kind="video" onPicked={() => setMobileView('preview')} />
              ) : (
                <ImageLibrary
                  studio={studio}
                  kind="image"
                  source={mobileLib}
                  onPicked={() => setMobileView('preview')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Two-panel body (≥lg) */}
      <div
        className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[var(--left-col)_1fr]"
        style={{ '--left-col': `${leftWidth}px` } as React.CSSProperties}
      >
        <aside className="relative min-h-0 border-r border-line bg-surface">
          <InputPanel
            studio={studio}
            space={space}
            settings={settings}
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

      <MobileTabBar value={mobileView} onChange={setMobileView} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        status={status}
        userEmail={userEmail}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onToggle={onToggleSetting}
        currentVerse={currentVerse}
        onSaveVerseDefault={() => setVerseDefault(currentVerse)}
        onClearVerseDefault={() => setVerseDefault(null)}
      />
    </div>
  );
}
