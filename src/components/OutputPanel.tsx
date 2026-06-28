import { useEffect, useState } from 'react';
import { config } from '../config';
import type { Job, Stage, useStudio } from '../lib/useStudio';
import { saveAdToLibrary } from '../lib/library';
import { Check, Download, ImageIcon, Spinner, VideoIcon } from './icons';

type Studio = ReturnType<typeof useStudio>;

function jobProgress(job: Job): number | null {
  const active = job.stages.find((s) => s.status === 'active');
  return active?.progress != null ? Math.round(active.progress * 100) : null;
}

function JobChip({
  job,
  selected,
  onSelect,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = jobProgress(job);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${job.label} · ${job.aspect}`}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${
        selected
          ? 'border-brand bg-brand/5 text-ink'
          : 'border-line bg-surface text-muted hover:border-faint'
      }`}
    >
      <span className="text-faint">
        {job.kind === 'video' ? (
          <VideoIcon width={14} height={14} />
        ) : (
          <ImageIcon width={14} height={14} />
        )}
      </span>
      <span className="max-w-[120px] truncate">{job.label}</span>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {job.status === 'done' && <Check />}
        {job.status === 'running' && <Spinner className="text-brand" />}
        {job.status === 'queued' && <span className="h-2 w-2 rounded-full bg-line" />}
        {job.status === 'error' && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      {job.status === 'running' && pct != null && (
        <span className="tabular-nums text-[12px] text-muted">{pct}%</span>
      )}
    </button>
  );
}

function StageRow({ stage }: { stage: Stage }) {
  const pct = stage.progress != null ? Math.round(stage.progress * 100) : null;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {stage.status === 'done' && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
            <Check />
          </span>
        )}
        {stage.status === 'active' && <Spinner className="text-brand" />}
        {stage.status === 'pending' && (
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        )}
        {stage.status === 'error' && (
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        )}
      </span>
      <span
        className={`text-[14px] font-medium ${
          stage.status === 'pending' ? 'text-faint' : 'text-ink'
        }`}
      >
        {stage.label}
      </span>
      {stage.status === 'active' && pct != null && (
        <span className="ml-auto text-[13px] font-semibold tabular-nums text-muted">
          {pct}%
        </span>
      )}
    </div>
  );
}

function PreviewFrame({
  aspect,
  safeArea,
  children,
}: {
  aspect: string;
  safeArea?: boolean;
  children: React.ReactNode;
}) {
  // Size tall/square formats by height; only 16:9 sizes by width.
  const byHeight = aspect !== '16:9';
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
      style={{
        aspectRatio: aspect.replace(':', ' / '),
        height: byHeight ? 'min(74vh, 720px)' : undefined,
        width: byHeight ? undefined : 'min(80%, 880px)',
        maxWidth: '100%',
      }}
    >
      {children}
      {safeArea && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-x-[6%] inset-y-[10%] rounded-lg border border-dashed border-white/45" />
          <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85">
            Safe area
          </span>
        </div>
      )}
    </div>
  );
}

export function OutputPanel({
  studio,
  space = 'ads',
}: {
  studio: Studio;
  space?: 'ads' | 'social' | 'product';
}) {
  const { jobs, selectedJob } = studio;
  const showSafe = space === 'social' && !!studio.platform;
  // Frame mirrors the selected job (so chips of different aspects preview right);
  // before any job exists, mirror the current form selection.
  const aspect = selectedJob?.aspect ?? studio.aspect;
  const format = selectedJob?.format ?? studio.format;
  const kindLabel = format === 'video' ? 'VIDEO' : 'IMAGE';
  const asset = selectedJob?.asset ?? null;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  // Track which jobs have been saved so re-selecting a saved job doesn't offer a
  // duplicate save (saving the same asset twice creates a duplicate library row).
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => new Set());
  const alreadySaved = !!selectedJob && savedJobIds.has(selectedJob.id);

  // Reset only the transient save state when the user switches jobs.
  useEffect(() => {
    setSaveState('idle');
  }, [selectedJob?.id]);

  async function saveToLibrary() {
    if (!asset || !selectedJob || alreadySaved) return;
    const jobId = selectedJob.id;
    setSaveState('saving');
    try {
      await saveAdToLibrary(asset, {
        title: selectedJob.reference ?? undefined,
        format: selectedJob.format,
        aspect: selectedJob.aspect,
        language: selectedJob.language,
        reference: selectedJob.reference,
        versionAbbr: selectedJob.versionAbbr,
      });
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      setSaveState('idle');
    } catch {
      setSaveState('error');
    }
  }

  function download() {
    if (!asset) return;
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = `verse-ad.${asset.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-10 pt-7">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-faint">
          Preview · {kindLabel} · {aspect}
        </span>
      </div>

      {jobs.length > 0 && (
        <div className="scroll-slim flex gap-2 overflow-x-auto px-10 pt-4">
          {jobs.map((job) => (
            <JobChip
              key={job.id}
              job={job}
              selected={job.id === selectedJob?.id}
              onSelect={() => studio.selectJob(job.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 items-center justify-center px-10 py-8">
        {!selectedJob && (
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-faint shadow-sm ring-1 ring-line">
              <ImageIcon width={26} height={26} />
            </div>
            <h2 className="mb-2 text-[20px] font-bold text-ink">
              Your ad preview appears here
            </h2>
            <p className="text-[14px] leading-relaxed text-muted">
              Pick a language and verse range on the left, then generate to see your{' '}
              {format === 'video' ? 'video' : 'image'} ad render in {aspect}. You can keep
              editing and queue more while a render runs.
            </p>
          </div>
        )}

        {selectedJob && (selectedJob.status === 'queued' || selectedJob.status === 'running') && (
          <div className="flex w-full max-w-md flex-col items-center">
            <PreviewFrame aspect={aspect} safeArea={showSafe}>
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
                <div className="h-full w-full animate-pulse-soft bg-[radial-gradient(circle_at_50%_30%,rgba(254,55,69,0.25),transparent_60%)]" />
              </div>
            </PreviewFrame>
            <div className="mt-7 w-full max-w-xs rounded-2xl border border-line bg-surface p-4">
              {selectedJob.status === 'queued' && (
                <p className="mb-1 text-center text-[13px] font-semibold text-muted">
                  Queued — waiting for the current render…
                </p>
              )}
              {selectedJob.stages.map((s) => (
                <StageRow key={s.id} stage={s} />
              ))}
            </div>
          </div>
        )}

        {selectedJob && selectedJob.status === 'done' && asset && (
          <div className="flex animate-fade-up flex-col items-center">
            <PreviewFrame aspect={aspect} safeArea={showSafe}>
              {asset.kind === 'image' ? (
                <img src={asset.url} alt="Generated verse ad" className="h-full w-full object-contain" />
              ) : (
                <video
                  src={asset.url}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )}
            </PreviewFrame>

            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={download}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-7 text-[15px] font-semibold text-white transition hover:bg-black active:scale-[0.99]"
                >
                  <Download /> Download {asset.ext.toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={saveToLibrary}
                  disabled={saveState === 'saving' || alreadySaved}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-[15px] font-semibold text-ink transition hover:bg-line-soft disabled:opacity-60"
                >
                  {saveState === 'saving' && <Spinner className="text-muted" />}
                  {alreadySaved && <Check />}
                  {alreadySaved
                    ? 'Saved'
                    : saveState === 'error'
                      ? 'Retry save'
                      : 'Save to library'}
                </button>
              </div>
              {saveState === 'error' && (
                <p className="text-[12px] text-brand">Couldn’t save — try again.</p>
              )}
              {asset.note && (
                <p className="max-w-xs text-center text-[12px] leading-relaxed text-muted">
                  {asset.note}
                </p>
              )}
            </div>
          </div>
        )}

        {selectedJob && selectedJob.status === 'error' && (
          <div className="max-w-sm text-center">
            <h2 className="mb-2 text-[18px] font-bold text-ink">Generation failed</h2>
            <p className="mb-5 text-[14px] leading-relaxed text-muted">{selectedJob.error}</p>
            <button
              type="button"
              onClick={studio.generate}
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-line-soft"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="px-10 pb-6 text-center">
          <p className="text-[12px] text-faint">
            {config.brand.name} · rendered in your browser
          </p>
        </div>
      )}
    </div>
  );
}
