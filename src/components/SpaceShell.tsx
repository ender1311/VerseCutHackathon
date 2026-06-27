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
      <header className="flex shrink-0 items-center justify-between border-b border-line px-7 py-3.5">
        <div className="flex items-center gap-3">
          <img
            src={config.brand.logoPath}
            alt=""
            className="h-9 w-9 rounded-[11px]"
          />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight text-ink">
              {config.brand.name}
            </div>
            <div className="text-[12px] font-medium text-muted">{config.brand.tagline}</div>
          </div>
        </div>
        <SpaceSwitcher />
        <div className="flex items-center gap-3">
          {userEmail && (
            <div className="flex items-center gap-2.5">
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
      <main className="min-h-0 flex-1 overflow-y-auto bg-panel">{children}</main>
    </div>
  );
}
