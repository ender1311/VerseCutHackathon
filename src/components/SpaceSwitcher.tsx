'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SPACES = [
  { href: '/', label: 'Digital Ads' },
  { href: '/social', label: 'Social' },
] as const;

export function SpaceSwitcher() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 rounded-full bg-panel p-1">
      {SPACES.map((s) => {
        const active = s.href === '/' ? pathname === '/' : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              active
                ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-muted hover:text-ink'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
