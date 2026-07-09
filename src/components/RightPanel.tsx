import type { useStudio } from '../lib/useStudio';
import { OutputPanel } from './OutputPanel';
import { ImageLibrary } from './ImageLibrary';
import { GeneratedLibrary } from './GeneratedLibrary';

type Studio = ReturnType<typeof useStudio>;
export type RightView = 'output' | 'videos' | 'youversion' | 'unsplash' | 'generated';

const TABS: { id: RightView; label: string }[] = [
  { id: 'output', label: 'Preview' },
  { id: 'youversion', label: 'YouVersion' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'videos', label: 'Video library' },
  { id: 'generated', label: 'Saved assets' },
];

export function RightPanel({
  studio,
  space = 'ads',
  view,
  setView,
}: {
  studio: Studio;
  space?: 'ads' | 'social' | 'product';
  view: RightView;
  setView: (v: RightView) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-surface px-4 py-2">
        {TABS.map((t) => (
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
      </div>
      <div className="min-h-0 flex-1">
        {view === 'output' && <OutputPanel studio={studio} space={space} />}
        {view === 'generated' && <GeneratedLibrary />}
        {view === 'youversion' && (
          <ImageLibrary studio={studio} kind="image" source="youversion" onPicked={() => setView('output')} />
        )}
        {view === 'unsplash' && (
          <ImageLibrary studio={studio} kind="image" source="unsplash" onPicked={() => setView('output')} />
        )}
        {view === 'videos' && (
          <ImageLibrary studio={studio} kind="video" onPicked={() => setView('output')} />
        )}
      </div>
    </div>
  );
}
