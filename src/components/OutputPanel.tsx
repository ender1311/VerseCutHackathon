import { useEffect, useState } from 'react';
import { config } from '../config';
import { resolveDraftBackground } from '../lib/draftBackground';
import type { Job, Stage, useStudio } from '../lib/useStudio';
import { saveAdToLibrary } from '../lib/library';
import { Button } from './ui';
import { Check, Download, ImageIcon, Spinner, VideoIcon } from './icons';

type Studio = ReturnType<typeof useStudio>;

// Sample verse ads (9:16) looped in the empty-state preview, picked at random
// per load so the showcase varies.
const SAMPLE_PREVIEWS = [
  '/assets/videos/sample-verse-ad.mp4',
  '/assets/videos/D9bb83Zxz1g.mp4',
];

function jobProgress(job: Job): number | null {
  const active = job.stages.find((s) => s.status === 'active');
  return active?.progress != null ? Math.round(active.progress * 100) : null;
}

/** Overall 0..1 completion across all stages (done = 1, active = its fraction). */
function overallFraction(job: Job): number {
  const n = job.stages.length;
  if (!n) return 0;
  let acc = 0;
  for (const s of job.stages) {
    if (s.status === 'done') acc += 1;
    else if (s.status === 'active') acc += s.progress ?? 0;
  }
  return Math.min(1, acc / n);
}

/** Overall progress bar + elapsed/estimate readout for an in-flight render. */
function RenderProgress({ job }: { job: Job }) {
  const [now, setNow] = useState(() => Date.now());
  const running = job.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  const frac = overallFraction(job);
  const elapsed = job.startedAt ? Math.max(0, (now - job.startedAt) / 1000) : 0;
  // Blend the real stage progress with elapsed-vs-estimate so the bar keeps
  // creeping during long single stages (e.g. real-time video capture) without
  // ever reaching 100% before the render actually finishes.
  const timeFrac = job.estimateSec > 0 ? elapsed / job.estimateSec : 0;
  const display = Math.min(0.99, Math.max(frac, running ? Math.min(timeFrac, 0.95) : 0));
  const pct = Math.round(display * 100);
  const remaining = Math.max(0, Math.ceil(job.estimateSec - elapsed));

  return (
    <div className="mb-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-faint">
        <span>{pct}%</span>
        <span>
          {running
            ? remaining > 0
              ? `~${remaining}s left`
              : 'almost done…'
            : `~${job.estimateSec}s`}
        </span>
      </div>
    </div>
  );
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
  capPx = 720,
  children,
}: {
  aspect: string;
  safeArea?: boolean;
  /** Max height cap (px) for height-driven formats; raised in the side layout. */
  capPx?: number;
  children: React.ReactNode;
}) {
  // Size tall/square formats by height; only 16:9 sizes by width. The frame
  // fills the available height of its (flex-constrained) parent and never
  // overflows it — so the whole preview stays visible on small screens, with
  // a hard cap on large desktop viewports.
  const byHeight = aspect !== '16:9';
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
      style={{
        aspectRatio: aspect.replace(':', ' / '),
        height: byHeight ? '100%' : undefined,
        width: byHeight ? undefined : 'min(100%, 880px)',
        maxHeight: `min(100%, ${capPx}px)`,
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
  // Portrait formats get a side-by-side layout on desktop (metadata to the
  // right) so the preview can use the full panel height and render larger.
  const isTall = aspect === '9:16' || aspect === '4:5';
  const format = selectedJob?.format ?? studio.format;
  const kindLabel = format === 'video' ? 'VIDEO' : 'IMAGE';
  const asset = selectedJob?.asset ?? null;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  // Track which jobs have been saved so re-selecting a saved job doesn't offer a
  // duplicate save (saving the same asset twice creates a duplicate library row).
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => new Set());
  const alreadySaved = !!selectedJob && savedJobIds.has(selectedJob.id);
  // Optional title + tags the user can attach before saving.
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  // A sample ad looping in the empty-state preview — randomized per load.
  // Set after mount to avoid an SSR/client hydration mismatch.
  const [samplePreview, setSamplePreview] = useState<string | null>(null);
  useEffect(() => {
    setSamplePreview(SAMPLE_PREVIEWS[Math.floor(Math.random() * SAMPLE_PREVIEWS.length)]);
  }, []);

  // Object URLs for local uploads (revoked when the File changes / unmounts).
  // When the File is cleared, ignore any stale URL — don't setState(null) in
  // the effect (avoids cascading-render lint on the clear path).
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!studio.imageFile) return;
    const url = URL.createObjectURL(studio.imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [studio.imageFile]);
  useEffect(() => {
    if (!studio.videoFile) return;
    const url = URL.createObjectURL(studio.videoFile);
    setVideoObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [studio.videoFile]);

  const draftBg = resolveDraftBackground(
    {
      imageFile: studio.imageFile,
      videoFile: studio.videoFile,
      sharedBg: studio.sharedBg,
      libraryVideo: studio.libraryVideo,
    },
    {
      image: studio.imageFile ? imageObjectUrl : null,
      video: studio.videoFile ? videoObjectUrl : null,
    },
  );

  // Reset transient save state + metadata inputs when the user switches jobs.
  useEffect(() => {
    setSaveState('idle');
    setTitle('');
    setTagsInput('');
  }, [selectedJob?.id]);

  async function saveToLibrary() {
    if (!asset || !selectedJob || alreadySaved) return;
    const jobId = selectedJob.id;
    setSaveState('saving');
    try {
      await saveAdToLibrary(asset, {
        title: title.trim() || undefined,
        format: selectedJob.format,
        aspect: selectedJob.aspect,
        language: selectedJob.language,
        reference: selectedJob.reference,
        versionAbbr: selectedJob.versionAbbr,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
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
      <div className="px-6 pt-4 md:px-10 md:pt-7">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-faint">
          Preview · {kindLabel} · {aspect}
        </span>
      </div>

      {jobs.length > 0 && (
        <div className="scroll-slim flex gap-2 overflow-x-auto px-6 pt-3 md:px-10 md:pt-4">
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

      <div className="flex min-h-0 flex-1 flex-col px-6 py-5 md:px-10 md:py-8">
        {!selectedJob && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-5">
            {draftBg ? (
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <PreviewFrame aspect={aspect}>
                  {draftBg.kind === 'video' ? (
                    <video
                      key={draftBg.url}
                      src={draftBg.url}
                      className="h-full w-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      key={draftBg.url}
                      src={draftBg.url}
                      alt={draftBg.label ?? 'Selected background'}
                      className="h-full w-full object-cover"
                    />
                  )}
                </PreviewFrame>
              </div>
            ) : (
              samplePreview && (
                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                  <PreviewFrame aspect="9:16">
                    <video
                      key={samplePreview}
                      src={samplePreview}
                      className="h-full w-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  </PreviewFrame>
                </div>
              )
            )}
            <div className="max-w-sm shrink-0 text-center">
              <h2 className="mb-2 text-[20px] font-bold text-ink">
                {draftBg ? 'Background selected' : 'Your ad preview appears here'}
              </h2>
              <p className="text-[14px] leading-relaxed text-muted">
                {draftBg
                  ? `Your selected background is ready. Generate to render your ${format === 'video' ? 'video' : 'image'} ad in ${aspect}.`
                  : `An example is playing above. Pick a language and verse range, then generate to see your ${format === 'video' ? 'video' : 'image'} ad render in ${aspect}.`}
              </p>
            </div>
          </div>
        )}

        {selectedJob && (selectedJob.status === 'queued' || selectedJob.status === 'running') && (
          <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center">
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              <PreviewFrame aspect={aspect} safeArea={showSafe}>
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
                  <div className="h-full w-full animate-pulse-soft bg-[radial-gradient(circle_at_50%_30%,rgba(254,55,69,0.25),transparent_60%)]" />
                </div>
              </PreviewFrame>
            </div>
            <div className="mt-4 w-full max-w-xs shrink-0 rounded-2xl border border-line bg-surface p-4">
              {selectedJob.status === 'queued' && (
                <p className="mb-3 text-center text-[13px] font-semibold text-muted">
                  Queued — waiting for the current render…
                </p>
              )}
              {selectedJob.status === 'running' && <RenderProgress job={selectedJob} />}
              {selectedJob.stages.map((s) => (
                <StageRow key={s.id} stage={s} />
              ))}
            </div>
          </div>
        )}

        {selectedJob && selectedJob.status === 'done' && asset && (
          <div
            className={`flex min-h-0 w-full flex-1 animate-fade-up flex-col items-center ${
              isTall ? 'md:flex-row md:items-stretch md:justify-center md:gap-8' : ''
            }`}
          >
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              <PreviewFrame aspect={aspect} safeArea={showSafe} capPx={isTall ? 1200 : 720}>
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
            </div>

            <div
              className={`mt-4 flex w-full max-w-md shrink-0 flex-col items-center gap-3 ${
                isTall ? 'md:mt-0 md:w-72 md:max-w-none md:items-stretch md:justify-center' : ''
              }`}
            >
              {!alreadySaved && (
                <div className="flex w-full flex-col gap-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Title (optional) — defaults to “${selectedJob.reference ?? 'verse'}”`}
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink outline-none transition focus:border-brand"
                  />
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Tags (optional, comma-separated)"
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink outline-none transition focus:border-brand"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="dark" onClick={download}>
                  <Download /> Download {asset.ext.toUpperCase()}
                </Button>
                <Button
                  variant="secondary"
                  onClick={saveToLibrary}
                  disabled={saveState === 'saving' || alreadySaved}
                >
                  {saveState === 'saving' && <Spinner className="text-muted" />}
                  {alreadySaved && <Check />}
                  {alreadySaved
                    ? 'Saved'
                    : saveState === 'error'
                      ? 'Retry save'
                      : 'Save to library'}
                </Button>
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
          <div className="m-auto max-w-sm text-center">
            <h2 className="mb-2 text-[18px] font-bold text-ink">Generation failed</h2>
            <p className="mb-5 text-[14px] leading-relaxed text-muted">{selectedJob.error}</p>
            <Button variant="secondary" onClick={studio.generate}>
              Try again
            </Button>
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="shrink-0 px-6 pb-3 text-center md:px-10 md:pb-6">
          <p className="text-[12px] text-faint">
            {config.brand.name} · rendered in your browser
          </p>
        </div>
      )}
    </div>
  );
}
