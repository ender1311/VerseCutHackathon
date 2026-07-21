// End-to-end check for the S3 upload path. Loads AWS_* from .env.local,
// uploads a real JPEG public-read, and confirms the URL resolves.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getAwsEnv, uploadToS3 } from '../src/lib/server/aws';
import { s3KeyForVersion } from '../src/lib/export/awsPath';

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

async function main() {
  const env = getAwsEnv();
  if (!env) {
    console.error('AWS not configured in .env.local');
    process.exit(2);
  }
  const bytes = new Uint8Array(readFileSync(process.argv[2] ?? '/tmp/air-1080.jpg'));
  const key = s3KeyForVersion({ bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 }, '111');
  console.error(`Uploading to s3://${env.bucket}/${key} …`);
  const { url } = await uploadToS3(bytes, { key, mime: 'image/jpeg', env });
  console.log('Public URL:', url);
  const check = await fetch(url);
  console.log(`resolves: HTTP ${check.status} ${check.headers.get('content-type')}`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
