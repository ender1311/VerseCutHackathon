// Re-verify all three upload destinations end-to-end using the actual server
// upload functions and a real image. Loads creds from .env.local.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getAwsEnv, uploadToS3 } from '../src/lib/server/aws';
import { getAirEnv, uploadToAir } from '../src/lib/server/air';
import { getBrazeEnv, uploadToBraze } from '../src/lib/server/braze';
import { exportAssetPath } from '../src/lib/export/awsPath';

const here = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(here, '../.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
} catch {}

const bytes = new Uint8Array(readFileSync(process.argv[2] ?? '/tmp/air-1080.jpg'));

async function resolves(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    return `HTTP ${r.status} ${r.headers.get('content-type')}`;
  } catch (e) {
    return `fetch error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function run(name: string, fn: () => Promise<string>) {
  try {
    const url = await fn();
    const status = await resolves(url);
    const ok = status.startsWith('HTTP 2');
    console.log(`${ok ? '✅' : '❌'} ${name}: ${url}\n     resolves: ${status}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  const ref = { bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 };

  await run('AWS S3', async () => {
    const env = getAwsEnv();
    if (!env) throw new Error('AWS not configured');
    const { url } = await uploadToS3(bytes, {
      key: exportAssetPath('test', ref, 'verify-111'),
      mime: 'image/jpeg',
      env,
    });
    return url;
  });

  await run('AIR', async () => {
    const env = getAirEnv();
    if (!env) throw new Error('AIR not configured');
    const { cdnUrl } = await uploadToAir(bytes, { fileName: 'verify-111.jpg', mime: 'image/jpeg', env });
    return cdnUrl;
  });

  await run('Braze', async () => {
    const env = getBrazeEnv();
    if (!env) throw new Error('Braze not configured');
    const { url } = await uploadToBraze(bytes, { name: 'versecut-verify-111', mime: 'image/jpeg', env });
    return url;
  });
}

main();
