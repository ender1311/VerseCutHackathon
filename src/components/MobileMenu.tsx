'use client';

import { useEffect } from 'react';
import { XMark } from './icons';

export function MobileMenu({
  open,
  onClose,
  status,
  userEmail,
  onOpenSavedAds,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  status: { label: string; dot: string };
  userEmail?: string | null;
  onOpenSavedAds: () => void;
  onOpenSettings: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end md:hidden">
      <div className="absolute inset-0 bg-black/30" role="presentation" aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="relative flex h-full w-72 max-w-[80%] flex-col border-l border-line bg-surface px-5 pt-5 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[16px] font-extrabold text-ink">Menu</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-full bg-panel px-3.5 py-2">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className="text-[13px] font-semibold text-muted">{status.label}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSavedAds();
          }}
          className="rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-ink transition hover:bg-line-soft"
        >
          Saved ads
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-ink transition hover:bg-line-soft"
        >
          Settings
        </button>

        <div className="mt-auto border-t border-line pt-4">
          {userEmail && (
            <>
              <div className="mb-2 text-[13px] font-medium text-muted">{userEmail}</div>
              <a
                href="/auth/signout"
                className="block rounded-lg px-3 py-2.5 text-[15px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
              >
                Sign out
              </a>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
