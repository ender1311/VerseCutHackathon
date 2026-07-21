'use client';

import { useEffect, useState } from 'react';
import { InputPanel } from './components/InputPanel';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { OutputPanel } from './components/OutputPanel';
import { GeneratedLibrary } from './components/GeneratedLibrary';
import { ImageLibrary } from './components/ImageLibrary';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileMenu } from './components/MobileMenu';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Shell, isDarkMode } from './components/shells';
import { DesktopHeader } from './components/shells/DesktopHeader';
import { LibraryModal } from './components/shells/LibraryModal';
import { Segmented } from './components/ui';
import { Menu } from './components/icons';
import { type MobileView } from './lib/mobileNav';
import { type LibraryView } from './lib/libraryView';
import { useStudio } from './lib/useStudio';
import {
  DEFAULT_APP_SETTINGS,
  readStoredAppSettings,
  toggleSetting,
  writeStoredAppSettings,
  type SettingKey,
  type UiMode,
  type VerseDefault,
} from './lib/appSettings';

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
  space?: 'ads' | 'social';
}) {
  const studio = useStudio();
  const statusKey = studio.isRendering ? 'running' : (studio.selectedJob?.status ?? 'idle');
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
  const setUiMode = (mode: UiMode) =>
    setSettings((s) => {
      const next = { ...s, uiMode: mode };
      writeStoredAppSettings(next);
      return next;
    });

  const [mobileView, setMobileView] = useState<MobileView>('edit');
  const [mobileLib, setMobileLib] = useState<LibraryView>('generated');
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop shared library browser (opened from any shell's "Browse library").
  const [libOpen, setLibOpen] = useState(false);
  const [libView, setLibView] = useState<LibraryView>('youversion');

  const dark = isDarkMode(settings.uiMode);

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
      {/* Mobile / tablet header (<lg) */}
      <header className="shrink-0 border-b border-line lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
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
      </header>

      {/* Mobile / tablet body (<lg): one view at a time. The mobile flow is
          shared by every desktop UI mode — mode switching only affects ≥lg. */}
      <div className="min-h-0 flex-1 overflow-hidden lg:hidden">
        {mobileView === 'edit' && (
          <InputPanel
            studio={studio}
            space={space}
            settings={settings}
            onBrowse={(v) => {
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
                onChange={(v) => setMobileLib(v as LibraryView)}
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

      {/* Desktop (≥lg): shared header + the selected UI shell. */}
      <div
        className={`hidden min-h-0 flex-1 flex-col lg:flex ${dark ? 'bg-[#0c0b0b]' : 'bg-surface'}`}
      >
        <DesktopHeader
          dark={dark}
          userEmail={userEmail}
          status={status}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="min-h-0 flex-1">
          <Shell
            mode={settings.uiMode}
            studio={studio}
            space={space}
            settings={settings}
            onBrowse={(v) => {
              setLibView(v);
              setLibOpen(true);
            }}
          />
        </div>
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
        onSetUiMode={setUiMode}
        currentVerse={currentVerse}
        onSaveVerseDefault={() => setVerseDefault(currentVerse)}
        onClearVerseDefault={() => setVerseDefault(null)}
      />
      <LibraryModal
        studio={studio}
        open={libOpen}
        view={libView}
        setView={setLibView}
        onClose={() => setLibOpen(false)}
      />
    </div>
  );
}
