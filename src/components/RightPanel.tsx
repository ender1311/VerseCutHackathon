import type { useStudio } from '../lib/useStudio';
import { OutputPanel } from './OutputPanel';
import { ImageLibrary } from './ImageLibrary';

type Studio = ReturnType<typeof useStudio>;
export type RightView = 'output' | 'videos' | 'images';

const TABS: { id: RightView; label: string }[] = [
  { id: 'output', label: 'Preview' },
  { id: 'videos', label: 'Video library' },
  { id: 'images', label: 'Background library' },
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
        {view === 'videos' && (
          <ImageLibrary studio={studio} kind="video" onPicked={() => setView('output')} />
        )}
        {view === 'images' && (
          <ImageLibrary studio={studio} kind="image" onPicked={() => setView('output')} />
        )}
      </div>
    </div>
  );
}
