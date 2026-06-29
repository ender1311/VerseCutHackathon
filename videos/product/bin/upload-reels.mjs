#!/usr/bin/env node
// Pull downloaded Instagram reels into the production asset library as social
// reference videos (Vercel Blob + SharedAsset rows, kind 'video'). Writes to
// PRODUCTION. Run after downloading reels into reference/instagram/.
//
//   node videos/product/bin/upload-reels.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(resolve('.env.local'));
loadEnv(resolve('.env'));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'reference', 'instagram');
const files = readdirSync(dir).filter((f) => f.endsWith('.mp4'));
if (!files.length) {
  console.error('No reels in', dir);
  process.exit(1);
}

const { put } = await import('@vercel/blob');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

for (const f of files) {
  const code = f.replace(/\.mp4$/, '');
  let author = 'youversion';
  try {
    const info = JSON.parse(readFileSync(join(dir, `${code}.info.json`), 'utf8'));
    author = info.uploader || info.channel || author;
  } catch {
    /* no info json */
  }
  const data = readFileSync(join(dir, f));
  const blob = await put(`social-reference/instagram/${f}`, data, {
    access: 'public',
    contentType: 'video/mp4',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });
  const asset = await prisma.sharedAsset.create({
    data: {
      ownerId: 'social-reference',
      ownerEmail: 'marketing@youversion.com',
      kind: 'video',
      name: `IG reel · ${author} · ${code}`,
      fileUrl: blob.url,
      mime: 'video/mp4',
      sizeBytes: data.length,
    },
  });
  console.log(`✓ ${f} → ${asset.id}`);
}
await prisma.$disconnect();
console.log(`\n✓ ${files.length} reels in the production library (social-reference)`);
