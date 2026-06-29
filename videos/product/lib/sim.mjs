// Simulator + Maestro capture helpers for product-marketing videos.
// Everything here runs locally on a Mac with Xcode + Maestro + ffmpeg.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MAESTRO =
  [`${process.env.HOME}/.maestro/bin/maestro`].find(existsSync) || 'maestro';

// Maestro needs a JDK; mirror figma/run_batch.sh's lookup.
function withJava(env = {}) {
  const extra = ['/opt/homebrew/opt/openjdk/bin'];
  try {
    const jh = execFileSync('/usr/libexec/java_home', [], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (jh) extra.push(join(jh, 'bin'));
  } catch {
    /* no system JDK */
  }
  return { ...process.env, ...env, PATH: `${extra.join(':')}:${process.env.PATH}` };
}

/** Resolve the target simulator UDID (arg → env → first booted). */
export function resolveDevice(explicit) {
  if (explicit) return explicit;
  if (process.env.PM_SIM_UDID) return process.env.PM_SIM_UDID;
  const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted']).toString();
  const m = out.match(/\(([0-9A-Fa-f-]{36})\)/);
  if (!m) throw new Error('No booted simulator found; boot one or pass --device.');
  return m[1];
}

export function bootIfNeeded(udid) {
  const booted = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted']).toString();
  if (!booted.includes(udid)) {
    execFileSync('xcrun', ['simctl', 'boot', udid]);
  }
}

export function openUrl(udid, url) {
  execFileSync('xcrun', ['simctl', 'openurl', udid, url]);
}

/** Run a Maestro flow file, passing -e KEY=VALUE for each env entry. */
export function runFlow(udid, flowFile, env = {}) {
  const args = ['--device', udid, 'test'];
  for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
  args.push(flowFile);
  execFileSync(MAESTRO, args, { stdio: 'inherit', env: withJava() });
}

/**
 * Record the simulator screen while `body()` runs (e.g. a Maestro flow), then
 * stop and return the path to the .mov. simctl writes H.264 by default.
 */
export async function recordWhile(udid, outMov, body) {
  const proc = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec', 'h264', '--force', outMov], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  // Give the recorder a beat to start.
  await sleep(1200);
  try {
    await body();
  } finally {
    await sleep(800);
    proc.kill('SIGINT'); // simctl finalizes the file on SIGINT
    await once(proc, 'exit');
  }
  return outMov;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function once(emitter, ev) {
  return new Promise((res) => emitter.once(ev, res));
}
