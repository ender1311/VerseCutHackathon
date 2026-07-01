import { withAuth } from '@workos-inc/authkit-nextjs';
import { SpaceShell } from '../../components/SpaceShell';
import { ProductBuilder } from '../../components/ProductBuilder';
import { ProductLibrary } from '../../components/ProductLibrary';

const CAPABILITIES = [
  { title: 'Multi-scene story', body: 'Sequence several verse/message beats into one film.' },
  { title: 'Voiceover', body: 'Narration via TTS, localized per language (HeyGen / ElevenLabs).' },
  { title: 'Subtitles', body: 'On-screen captions synced to the narration timing.' },
  { title: 'Ambient music', body: 'Background score mixed under the voiceover.' },
];

export default async function ProductMarketingPage() {
  const { user } = await withAuth();
  return (
    <SpaceShell userEmail={user?.email ?? null}>
      <div className="mx-auto max-w-3xl px-8 py-14">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand">
          Product Marketing
        </span>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-ink">
          Longer, narrated product films
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Build multi-scene marketing videos with voiceover, subtitles, and ambient
          music — rendered in the browser for quick clips, or offline via HyperFrames
          for premium hero films.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[14px] font-bold text-ink">{c.title}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-muted">{c.body}</div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <h2 className="mb-4 text-[18px] font-bold text-ink">Published videos</h2>
          <ProductLibrary />
        </div>
        <details className="mt-10 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-[14px] font-semibold text-ink">
            Build locally (dev)
          </summary>
          <ProductBuilder />
        </details>
      </div>
    </SpaceShell>
  );
}
