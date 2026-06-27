import { withAuth } from '@workos-inc/authkit-nextjs';
import { SpaceShell } from '../../components/SpaceShell';

const PLATFORMS = [
  { name: 'Instagram Story / Reel', ratio: '9:16', dims: '1080×1920' },
  { name: 'Instagram Feed', ratio: '4:5', dims: '1080×1350' },
  { name: 'TikTok', ratio: '9:16', dims: '1080×1920' },
  { name: 'Facebook Feed', ratio: '1:1', dims: '1080×1080' },
  { name: 'YouTube', ratio: '16:9', dims: '1920×1080' },
  { name: 'X / Twitter', ratio: '16:9', dims: '1600×900' },
];

export default async function SocialPage() {
  const { user } = await withAuth();
  return (
    <SpaceShell userEmail={user?.email ?? null}>
      <div className="mx-auto max-w-3xl px-8 py-14">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand">
          Social Engagement
        </span>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-ink">
          One verse, every platform
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Auto-format a verse asset for each social platform with the right aspect
          ratio and safe areas, then export per channel.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[14px] font-bold text-ink">{p.name}</div>
              <div className="mt-1 text-[12px] text-muted">
                {p.ratio} · {p.dims}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[13px] text-faint">Builder coming next.</p>
      </div>
    </SpaceShell>
  );
}
