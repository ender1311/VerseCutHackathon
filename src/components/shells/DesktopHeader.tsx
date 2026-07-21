'use client';

import { config } from '../../config';
import { SpaceSwitcher } from '../SpaceSwitcher';
import { Settings } from '../icons';

export interface ShellStatus {
  label: string;
  dot: string;
}

/**
 * The global desktop chrome shared by all shells: brand, space switcher,
 * settings, render status, and account. Theme-aware so Everdark can go dark
 * without each shell reimplementing the top bar.
 */
export function DesktopHeader({
  dark = false,
  userEmail,
  status,
  onOpenSettings,
}: {
  dark?: boolean;
  userEmail?: string | null;
  status: ShellStatus;
  onOpenSettings: () => void;
}) {
  return (
    <header
      className={`flex shrink-0 items-center justify-between border-b px-7 py-3.5 ${
        dark ? 'border-[#2b2828] bg-[#181616]' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-9 w-9 rounded-[11px]" />
        <div className="leading-tight">
          <div className={`text-[15px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
            {config.brand.name}
          </div>
          <div className={`text-[12px] font-medium ${dark ? 'text-[#8a8686]' : 'text-muted'}`}>
            {config.brand.tagline}
          </div>
        </div>
      </div>
      <SpaceSwitcher />
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Settings"
          onClick={onOpenSettings}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
            dark
              ? 'text-[#8a8686] hover:bg-[#2b2828] hover:text-white'
              : 'text-muted hover:bg-line-soft hover:text-ink'
          }`}
        >
          <Settings />
        </button>
        <div
          className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 ${
            dark ? 'bg-[#2b2828]' : 'bg-panel'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className={`text-[13px] font-semibold ${dark ? 'text-[#c9c5c5]' : 'text-muted'}`}>
            {status.label}
          </span>
        </div>
        {userEmail && (
          <div className={`flex items-center gap-2.5 border-l pl-3 ${dark ? 'border-[#2b2828]' : 'border-line'}`}>
            <span className={`hidden text-[13px] font-medium sm:inline ${dark ? 'text-[#8a8686]' : 'text-muted'}`}>
              {userEmail}
            </span>
            <a
              href="/auth/signout"
              className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
                dark
                  ? 'text-[#8a8686] hover:bg-[#2b2828] hover:text-white'
                  : 'text-muted hover:bg-line-soft hover:text-ink'
              }`}
            >
              Sign out
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
