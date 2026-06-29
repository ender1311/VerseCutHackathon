'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { Check, Download, Spinner, VideoIcon } from './icons';

interface FeatureInfo {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  langs: string[];
  lengths: string[];
  hasMusic: boolean;
}

interface OutputFile {
  name: string;
  length?: string;
  lang?: string;
  orientation?: string;
}

interface JobStatus {
  id: string;
  feature: string;
  status: 'running' | 'done' | 'error';
  log: string;
  code: number | null;
  outputs: OutputFile[];
}

const ALL_FORMATS = ['portrait', 'landscape'] as const;
const ALL_LENGTHS = ['short', 'long'] as const;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${
        active
          ? 'border-brand bg-brand/5 text-ink'
          : 'border-line bg-surface text-muted hover:border-faint'
      }`}
    >
      {children}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ProductBuilder() {
  const [features, setFeatures] = useState<FeatureInfo[] | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [featureId, setFeatureId] = useState<string>('');
  const [langs, setLangs] = useState<Set<string>>(new Set());
  const [formats, setFormats] = useState<Set<string>>(new Set(ALL_FORMATS));
  const [lengths, setLengths] = useState<Set<string>>(new Set(ALL_LENGTHS));
  const [capture, setCapture] = useState(false);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

  // Load the feature catalog.
  useEffect(() => {
    fetch('/api/pm/features')
      .then(async (r) => {
        if (r.status === 403) {
          setDisabled(true);
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((res) => {
        if (!res) return;
        const list: FeatureInfo[] = res.data ?? [];
        setFeatures(list);
        if (list[0]) {
          setFeatureId(list[0].id);
          setLangs(new Set(list[0].langs.slice(0, 1)));
        }
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  const feature = features?.find((f) => f.id === featureId) ?? null;

  // When the feature changes, reset language selection to its first language.
  useEffect(() => {
    if (feature) setLangs(new Set(feature.langs.slice(0, 1)));
  }, [featureId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll the log to the bottom as it grows.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log]);

  const poll = useCallback((id: string) => {
    const tick = async () => {
      try {
        const r = await fetch(`/api/pm/build/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { data } = await r.json();
        setJob(data as JobStatus);
        if (data.status === 'running') pollRef.current = setTimeout(tick, 1200);
      } catch {
        pollRef.current = setTimeout(tick, 2000);
      }
    };
    void tick();
  }, []);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const canBuild =
    !!featureId && langs.size > 0 && formats.size > 0 && lengths.size > 0 && !starting &&
    job?.status !== 'running';

  async function build() {
    if (!canBuild) return;
    setStarting(true);
    setStartError(null);
    setJob(null);
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      const r = await fetch('/api/pm/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: featureId,
          langs: [...langs],
          formats: [...formats],
          lengths: [...lengths],
          capture,
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error ?? `HTTP ${r.status}`);
      setJob({ id: res.data.jobId, feature: featureId, status: 'running', log: '', code: null, outputs: [] });
      poll(res.data.jobId);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  if (disabled) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface p-5">
        <div className="text-[14px] font-bold text-ink">Builder runs in local dev only</div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Product Marketing videos are rendered on your Mac — they need the iOS Simulator,
          Maestro, and ffmpeg. Run the app locally with <code className="rounded bg-line-soft px-1 py-0.5">npm run dev</code>{' '}
          and open this page at <code className="rounded bg-line-soft px-1 py-0.5">localhost:3000</code> to build.
        </p>
      </div>
    );
  }

  const running = job?.status === 'running';

  return (
    <div className="mt-8 space-y-6">
      {loadError && (
        <p className="text-[13px] text-brand">Couldn’t load features: {loadError}</p>
      )}

      {/* Feature */}
      <div>
        <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">Feature</div>
        <div className="flex flex-wrap gap-2">
          {(features ?? []).map((f) => (
            <Chip key={f.id} active={f.id === featureId} onClick={() => setFeatureId(f.id)}>
              {f.title}
            </Chip>
          ))}
          {features && !features.length && (
            <span className="text-[13px] text-muted">No features found in videos/product/features.</span>
          )}
        </div>
      </div>

      {feature && (
        <>
          {/* Languages */}
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">Languages</div>
            <div className="flex flex-wrap gap-2">
              {feature.langs.map((l) => (
                <Chip key={l} active={langs.has(l)} onClick={() => setLangs((s) => toggle(s, l))}>
                  {l.toUpperCase()}
                </Chip>
              ))}
            </div>
          </div>

          {/* Formats + lengths */}
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">Formats</div>
              <div className="flex gap-2">
                {ALL_FORMATS.map((f) => (
                  <Chip key={f} active={formats.has(f)} onClick={() => setFormats((s) => toggle(s, f))}>
                    {f === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">Lengths</div>
              <div className="flex gap-2">
                {ALL_LENGTHS.map((l) => (
                  <Chip
                    key={l}
                    active={lengths.has(l)}
                    onClick={() => setLengths((s) => toggle(s, l))}
                  >
                    {l === 'short' ? 'Short (<15s)' : 'Long (>15s)'}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Capture toggle */}
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">Simulator capture</div>
            <div className="flex gap-2">
              <Chip active={capture} onClick={() => setCapture(true)}>
                Capture fresh from the iOS Simulator
              </Chip>
              <Chip active={!capture} onClick={() => setCapture(false)}>
                Reuse last capture
              </Chip>
            </div>
            <p className="mt-2 text-[12px] text-faint">
              Fresh capture boots the Simulator and runs the Maestro flow (needs the Bible app
              installed). Reuse renders from the previously captured clip.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" onClick={build} disabled={!canBuild}>
              {running ? <Spinner /> : <VideoIcon />}
              {running ? 'Building…' : 'Build videos locally'}
            </Button>
            {startError && <span className="text-[13px] text-brand">{startError}</span>}
          </div>
        </>
      )}

      {/* Job progress + log */}
      {job && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            {job.status === 'running' && <Spinner className="text-brand" />}
            {job.status === 'done' && <Check />}
            {job.status === 'error' && <span className="h-2 w-2 rounded-full bg-brand" />}
            <span className="text-ink">
              {job.status === 'running' && 'Rendering on your machine…'}
              {job.status === 'done' && 'Build complete'}
              {job.status === 'error' && `Build failed${job.code != null ? ` (exit ${job.code})` : ''}`}
            </span>
          </div>
          <pre
            ref={logRef}
            className="scroll-slim max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/90 p-3 font-mono text-[12px] leading-relaxed text-green-300"
          >
            {job.log || 'Starting…'}
          </pre>
        </div>
      )}

      {/* Output gallery */}
      {job?.status === 'done' && job.outputs.length > 0 && (
        <div>
          <div className="mb-3 text-[13px] font-bold uppercase tracking-wide text-faint">
            Rendered videos
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {job.outputs.map((o) => {
              const src = `/api/pm/file?feature=${encodeURIComponent(job.feature)}&name=${encodeURIComponent(o.name)}`;
              const portrait = o.orientation === 'portrait';
              return (
                <div key={o.name} className="rounded-xl border border-line bg-surface p-2">
                  <video
                    src={src}
                    controls
                    playsInline
                    className={`w-full rounded-lg bg-black ${portrait ? 'aspect-[9/16]' : 'aspect-video'} object-contain`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-muted" title={o.name}>
                      {o.length} · {o.lang?.toUpperCase()} · {o.orientation}
                    </span>
                    <a
                      href={src}
                      download={o.name}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
                      aria-label="Download"
                    >
                      <Download />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
