'use client';

import { MOBILE_TABS, type MobileView } from '../lib/mobileNav';
import { ImageIcon, Pencil, Play } from './icons';

const ICONS: Record<MobileView, typeof Pencil> = {
  edit: Pencil,
  preview: Play,
  library: ImageIcon,
};

export function MobileTabBar({
  value,
  onChange,
}: {
  value: MobileView;
  onChange: (v: MobileView) => void;
}) {
  return (
    <nav className="flex shrink-0 items-stretch border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {MOBILE_TABS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              active ? 'text-brand' : 'text-muted'
            }`}
          >
            <Icon width={20} height={20} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
