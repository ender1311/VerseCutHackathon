'use client';

import { useEffect } from 'react';
import type { useStudio } from '../../lib/useStudio';
import { LIBRARY_TABS, type LibraryView } from '../../lib/libraryView';
import { ImageLibrary } from '../ImageLibrary';
import { GeneratedLibrary } from '../GeneratedLibrary';
import { XMark } from '../icons';

type Studio = ReturnType<typeof useStudio>;

/**
 * Shared background/asset browser presented as a modal, used by every desktop
 * shell so "Browse library" behaves the same everywhere. Picking a background
 * closes the modal.
 */
export function LibraryModal({
  studio,
  open,
  view,
  setView,
  onClose,
}: {
  studio: Studio;
  open: boolean;
  view: LibraryView;
  setView: (v: LibraryView) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" role="presentation" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Browse library"
        className="relative flex h-full max-h-[820px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
          {LIBRARY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`rounded-lg px-3.5 py-2 text-[14px] font-semibold transition ${
                view === t.id ? 'bg-line-soft text-ink' : 'text-muted hover:bg-line-soft/60 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {view === 'generated' && <GeneratedLibrary />}
          {view === 'youversion' && (
            <ImageLibrary studio={studio} kind="image" source="youversion" onPicked={onClose} />
          )}
          {view === 'unsplash' && (
            <ImageLibrary studio={studio} kind="image" source="unsplash" onPicked={onClose} />
          )}
          {view === 'videos' && <ImageLibrary studio={studio} kind="video" onPicked={onClose} />}
        </div>
      </div>
    </div>
  );
}
