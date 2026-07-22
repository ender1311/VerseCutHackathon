import { config } from '../config';
import { SpaceSwitcher } from './SpaceSwitcher';

export function SpaceShell({
  userEmail,
  children,
}: {
  userEmail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="shrink-0 border-b border-line px-4 py-3 sm:px-7 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={config.brand.logoPath} alt="" className="h-9 w-9 shrink-0 rounded-[11px]" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-ink">
                {config.brand.name}
              </div>
              <div className="hidden truncate text-[12px] font-medium text-muted sm:block">
                {config.brand.tagline}
              </div>
            </div>
          </div>
          {/* Nav inline on desktop; a scrollable row below on mobile. */}
          <div className="hidden md:block">
            <SpaceSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {userEmail && (
              <div className="flex items-center gap-2.5">
                <span className="hidden text-[13px] font-medium text-muted lg:inline">
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
        <div className="-mx-1 mt-3 overflow-x-auto px-1 md:hidden">
          <SpaceSwitcher />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-panel">{children}</main>
    </div>
  );
}
