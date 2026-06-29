// Local-only bridge for the Product Marketing pipeline. These helpers spawn the
// `videos/product/bin/pm.mjs` CLI on the developer's Mac (it needs the iOS
// Simulator, Maestro, ffmpeg, etc.) and stream its progress back to the PM
// builder UI. They are HARD-DISABLED in production / on Vercel — the deployed
// app has none of those binaries and must never shell out.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const FORMATS = ['portrait', 'landscape'] as const;
export const LENGTHS = ['short', 'long'] as const;
const FEATURE_RE = /^[a-z0-9-]+$/;
const LANG_RE = /^[a-z]{2}$/;
const MP4_RE = /^[a-z0-9-]+\.mp4$/;
const MAX_LOG_LINES = 2000;

export type Format = (typeof FORMATS)[number];
export type Length = (typeof LENGTHS)[number];

/** True only in local development — never on Vercel / production. */
export function pmEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
}

const REPO_ROOT = process.cwd();
const PM_BIN = join(REPO_ROOT, 'videos', 'product', 'bin', 'pm.mjs');
const FEATURES_DIR = join(REPO_ROOT, 'videos', 'product', 'features');
const outDirFor = (feature: string) => join(REPO_ROOT, 'videos', 'product', 'out', feature);

export interface FeatureInfo {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  langs: string[];
  lengths: string[];
  hasMusic: boolean;
}

export function listFeatures(): FeatureInfo[] {
  if (!existsSync(FEATURES_DIR)) return [];
  const out: FeatureInfo[] = [];
  for (const id of readdirSync(FEATURES_DIR)) {
    if (!FEATURE_RE.test(id)) continue;
    const file = join(FEATURES_DIR, id, 'feature.json');
    if (!existsSync(file)) continue;
    try {
      const def = JSON.parse(readFileSync(file, 'utf8'));
      const langs = Object.keys(def.voices ?? def.scripts?.short ?? def.scripts?.long ?? {});
      out.push({
        id,
        title: def.title ?? id,
        subtitle: def.subtitle ?? '',
        cta: def.cta ?? '',
        langs,
        lengths: Object.keys(def.scripts ?? {}),
        hasMusic: !!def.music,
      });
    } catch {
      /* skip malformed feature.json */
    }
  }
  return out;
}

export interface OutputFile {
  name: string;
  length?: string;
  lang?: string;
  orientation?: string;
  mtime: number;
}

export function listOutputs(feature: string): OutputFile[] {
  if (!FEATURE_RE.test(feature)) return [];
  const dir = outDirFor(feature);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.mp4'))
    .map((name) => {
      // <feature>-<length>-<lang>-<orientation>.mp4
      const m = name.replace(/\.mp4$/, '').match(/-(short|long)-([a-z]{2})-(portrait|landscape)$/);
      return {
        name,
        length: m?.[1],
        lang: m?.[2],
        orientation: m?.[3],
        mtime: statSync(join(dir, name)).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Resolve a requested output file to an absolute path inside the feature's out dir, or null. */
export function resolveOutputPath(feature: string, name: string): string | null {
  if (!FEATURE_RE.test(feature) || !MP4_RE.test(name)) return null;
  const dir = outDirFor(feature);
  const full = resolve(dir, name);
  if (full !== join(dir, name)) return null; // reject traversal
  return existsSync(full) ? full : null;
}

interface Job {
  id: string;
  feature: string;
  status: 'running' | 'done' | 'error';
  logs: string[];
  code: number | null;
  startedAt: number;
  child: ChildProcess;
}

// In-memory registry. Dev-only; resets on server restart (acceptable).
const jobs = new Map<string, Job>();

export interface BuildRequest {
  feature: string;
  langs: string[];
  formats: string[];
  lengths: string[];
  capture: boolean;
}

export function startBuild(req: BuildRequest): { jobId: string } {
  const { feature } = req;
  if (!FEATURE_RE.test(feature) || !existsSync(join(FEATURES_DIR, feature))) {
    throw new Error('Unknown feature');
  }
  const langs = req.langs.filter((l) => LANG_RE.test(l));
  const formats = req.formats.filter((f) => (FORMATS as readonly string[]).includes(f));
  const lengths = req.lengths.filter((l) => (LENGTHS as readonly string[]).includes(l));
  if (!langs.length || !formats.length || !lengths.length) {
    throw new Error('Pick at least one language, format, and length');
  }

  const args = [
    PM_BIN,
    feature,
    '--langs', langs.join(','),
    '--formats', formats.join(','),
    '--lengths', lengths.join(','),
  ];
  if (!req.capture) args.push('--no-capture');

  // Maestro (capture) needs a JDK + the maestro CLI on PATH.
  const extraPath = ['/opt/homebrew/opt/openjdk/bin', join(process.env.HOME ?? '', '.maestro', 'bin')];
  const child = spawn('node', args, {
    cwd: REPO_ROOT,
    env: { ...process.env, PATH: `${extraPath.join(':')}:${process.env.PATH ?? ''}` },
  });

  const id = randomUUID();
  const job: Job = {
    id,
    feature,
    status: 'running',
    logs: [],
    code: null,
    startedAt: Date.now(),
    child,
  };
  jobs.set(id, job);

  const append = (chunk: Buffer) => {
    // ffmpeg writes progress with carriage returns; treat \r and \n alike so a
    // progress stream doesn't accrete into one unbounded line.
    for (const line of chunk.toString().split(/[\r\n]+/)) {
      if (line.length) job.logs.push(line);
    }
    if (job.logs.length > MAX_LOG_LINES) job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  child.on('error', (err) => {
    job.logs.push(`spawn error: ${err.message}`);
    job.status = 'error';
  });
  child.on('close', (code) => {
    job.code = code;
    if (job.status === 'running') job.status = code === 0 ? 'done' : 'error';
  });

  return { jobId: id };
}

export interface JobStatus {
  id: string;
  feature: string;
  status: Job['status'];
  log: string;
  code: number | null;
  outputs: OutputFile[];
}

export function getJob(id: string): JobStatus | null {
  const job = jobs.get(id);
  if (!job) return null;
  return {
    id: job.id,
    feature: job.feature,
    status: job.status,
    log: job.logs.join('\n'),
    code: job.code,
    outputs: job.status === 'done' ? listOutputs(job.feature) : [],
  };
}
