#!/usr/bin/env node
// Upload an APPROVED product-marketing video to the production asset library
// (Vercel Blob + Postgres). Run this only for clips you've reviewed and want
// live. It writes to PRODUCTION — pass an explicit file.
//
//   node videos/product/bin/upload.mjs videos/product/out/reading-plans/reading-plans-short-en-portrait.mp4
//
// Optional: --name "Reading Plans · short · en · 9:16"
import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// Load env (.env.local overrides .env) for BLOB_READ_WRITE_TOKEN + DB urls.
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

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file || !existsSync(file)) {
  console.error('Usage: upload.mjs <file.mp4> [--name "..."]');
  process.exit(1);
}
const nameFlag = (() => {
  const i = argv.indexOf('--name');
  return i >= 0 ? argv[i + 1] : null;
})();

// Derive metadata from the filename: <feature>-<length>-<lang>-<orientation>.mp4
const stem = basename(file).replace(/\.mp4$/, '');
const [feature, length, lang, orientation] = stem.split('-').length >= 4
  ? [stem.split('-').slice(0, -3).join('-'), ...stem.split('-').slice(-3)]
  : [stem, '', '', ''];
const aspect = orientation === 'landscape' ? '16:9' : '9:16';
const name = nameFlag || `${feature} · ${length} · ${lang} · ${aspect} (product marketing)`;

const { put } = await import('@vercel/blob');
const { PrismaClient } = await import('@prisma/client');

const data = readFileSync(file);
const blobPath = `product-marketing/${feature}/${stem}.mp4`;
console.log(`▶ uploading ${file} → Blob (${blobPath}) …`);
const blob = await put(blobPath, data, {
  access: 'public',
  contentType: 'video/mp4',
  token: process.env.BLOB_READ_WRITE_TOKEN,
  addRandomSuffix: true,
});
console.log(`  ✓ ${blob.url}`);

const prisma = new PrismaClient();
const asset = await prisma.sharedAsset.create({
  data: {
    ownerId: 'product-marketing',
    ownerEmail: 'marketing@youversion.com',
    kind: 'video',
    name,
    fileUrl: blob.url,
    mime: 'video/mp4',
    sizeBytes: data.length,
  },
});
await prisma.$disconnect();
console.log(`  ✓ library row ${asset.id}\n✓ live: "${name}"`);
