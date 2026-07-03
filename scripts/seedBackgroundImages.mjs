#!/usr/bin/env node
// Seed text-free YouVersion "prerendered_bg" backgrounds into the shared library.
//
// Fetches native background renditions from YouVersion's Images API 3.2
// (no AI text-removal needed — these are the same images without the baked-in
// verse text), uploads each to Vercel Blob, and registers a SharedAsset row.
//
// Usage:
//   node scripts/seedBackgroundImages.mjs                 # dry-run (default)
//   node scripts/seedBackgroundImages.mjs --commit        # write to prod Blob + DB
//   node scripts/seedBackgroundImages.mjs --commit --limit 8   # pilot
//   node scripts/seedBackgroundImages.mjs --target 300 --langs en,es,pt,fr
//
// Idempotent: image ids already present in the DB are skipped.

import { readFileSync } from 'node:fs';

// --- load .env.local (DATABASE_URL, BLOB_READ_WRITE_TOKEN) -------------------
const ROOT = new URL('..', import.meta.url).pathname;
for (const line of readFileSync(`${ROOT}.env.local`, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

// --- args --------------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const COMMIT = has('--commit');
const TARGET = Number(val('--target', '300'));
const LIMIT = args.includes('--limit') ? Number(val('--limit', '0')) : Infinity;
const LANGS = val('--langs', 'en,es,pt,fr').split(',').map((s) => s.trim()).filter(Boolean);

// --- YouVersion Images API ---------------------------------------------------
const IMAGES_API = 'https://images.youversionapi.com/3.2/items.json';
const HEADERS = {
  Referer: 'http://yvapi.youversionapi.com',
  'X-YouVersion-Client': 'youversion',
  'X-YouVersion-App-Platform': 'internal',
  'X-YouVersion-App-Version': '1',
  Accept: 'application/json',
  'User-Agent': 'versecut-bg-seed',
};

// Canonical Verse-of-the-Day references (from alfred/votd). Backgrounds are
// verse-agnostic, so a broad verse set maximises the distinct background pool.
const USFMS = [
  "1CH.16.11", "1CH.16.34", "1CO.1.10", "1CO.10.13", "1CO.10.31", "1CO.13.4", "1CO.13.6", "1CO.3.16",
  "1CO.3.7", "1JN.1.9", "1JN.2.6", "1JN.3.16", "1JN.4.15", "1JN.4.16", "1JN.4.19", "1JN.4.4",
  "1JN.4.9", "1KI.8.61", "1PE.2.24", "1PE.3.15", "1PE.4.16", "1PE.4.8", "1PE.5.7", "1PE.5.8",
  "1SA.2.2", "1TH.5.11", "1TH.5.15", "1TH.5.16", "1TH.5.17", "1TH.5.18", "1TI.2.5", "1TI.2.6",
  "1TI.4.12", "1TI.4.8", "1TI.6.12", "2CH.7.14", "2CO.12.10", "2CO.12.9", "2CO.3.17", "2CO.4.16",
  "2CO.4.18", "2CO.5.17", "2CO.5.18", "2CO.5.21", "2CO.7.10", "2CO.9.6", "2CO.9.7", "2CO.9.8",
  "2JN.1.6", "2PE.1.3", "2PE.3.9", "2TH.3.3", "2TI.1.7", "2TI.4.7", "ACT.1.8", "ACT.10.43",
  "ACT.2.38", "ACT.20.24", "ACT.20.35", "ACT.4.12", "ACT.4.31", "AMO.5.24", "COL.3.1", "COL.3.12",
  "COL.3.2", "COL.4.2", "DAN.12.3", "DEU.11.18", "DEU.31.8", "ECC.12.13", "EPH.1.7", "EPH.2.10",
  "EPH.2.18", "EPH.2.8", "EPH.2.9", "EPH.3.20", "EPH.3.21", "EPH.4.2", "EPH.4.32", "EPH.5.1",
  "EPH.6.11", "EPH.6.13", "EPH.6.18", "EST.4.14", "EXO.33.15", "EZK.36.26", "EZK.37.5", "GAL.2.20",
  "GAL.3.28", "GAL.5.13", "GAL.5.16", "GAL.5.24", "GAL.5.25", "GAL.6.9", "GEN.1.1", "GEN.2.3",
  "HAB.2.14", "HEB.10.24", "HEB.12.1", "HEB.12.11", "HEB.12.14", "HEB.12.2", "HEB.13.16", "HEB.4.10",
  "HEB.4.12", "HEB.4.9", "ISA.1.17", "ISA.12.2", "ISA.25.1", "ISA.26.4", "ISA.40.11", "ISA.40.3",
  "ISA.40.31", "ISA.40.8", "ISA.43.18", "ISA.43.19", "ISA.43.2", "ISA.53.5", "ISA.53.6", "ISA.55.6",
  "ISA.60.1", "ISA.60.3", "ISA.7.14", "ISA.9.6", "JAS.1.19", "JAS.1.2", "JAS.1.22", "JAS.1.3",
  "JAS.1.5", "JAS.3.13", "JAS.4.7", "JAS.5.13", "JAS.5.16", "JAS.5.8", "JDG.6.12", "JER.29.11",
  "JER.29.13", "JER.31.25", "JER.33.14", "JHN.1.12", "JHN.1.14", "JHN.1.29", "JHN.1.5", "JHN.10.10",
  "JHN.10.11", "JHN.13.34", "JHN.14.1", "JHN.14.6", "JHN.15.12", "JHN.15.2", "JHN.15.4", "JHN.16.13",
  "JHN.16.33", "JHN.20.21", "JHN.3.16", "JHN.3.17", "JHN.5.24", "JHN.6.35", "JHN.7.38", "JHN.8.12",
  "JHN.8.32", "JOS.1.9", "LAM.3.25", "LUK.1.35", "LUK.1.37", "LUK.1.45", "LUK.1.46", "LUK.1.47",
  "LUK.1.49", "LUK.12.15", "LUK.12.40", "LUK.16.10", "LUK.19.38", "LUK.2.10", "LUK.2.11", "LUK.2.7",
  "LUK.2.9", "LUK.6.28", "LUK.6.38", "LUK.9.24", "MAL.4.6", "MAT.10.20", "MAT.13.44", "MAT.16.24",
  "MAT.18.20", "MAT.19.26", "MAT.20.28", "MAT.24.42", "MAT.28.19", "MAT.28.6", "MAT.4.4", "MAT.5.10",
  "MAT.5.14", "MAT.5.16", "MAT.5.3", "MAT.5.4", "MAT.5.5", "MAT.5.6", "MAT.5.7", "MAT.5.8",
  "MAT.5.9", "MAT.6.19", "MAT.6.21", "MAT.6.25", "MAT.6.3", "MAT.6.33", "MAT.7.12", "MAT.7.14",
  "MAT.7.7", "MAT.7.8", "MAT.9.37", "MAT.9.38", "MIC.6.8", "MRK.10.14", "MRK.13.33", "MRK.16.15",
  "MRK.2.27", "MRK.8.35", "MRK.9.23", "NAM.1.7", "PHM.1.6", "PHP.1.3", "PHP.2.5", "PHP.4.13",
  "PHP.4.19", "PHP.4.4", "PHP.4.6", "PHP.4.7", "PHP.4.8", "PRO.11.25", "PRO.12.25", "PRO.13.20",
  "PRO.16.3", "PRO.16.9", "PRO.17.17", "PRO.18.10", "PRO.18.21", "PRO.18.24", "PRO.19.17", "PRO.19.21",
  "PRO.22.4", "PRO.23.24", "PRO.29.25", "PRO.3.5", "PRO.3.6", "PRO.31.25", "PRO.31.26", "PRO.31.30",
  "PRO.4.23", "PRO.9.10", "PSA.103.13", "PSA.103.2", "PSA.105.1", "PSA.113.3", "PSA.119.105", "PSA.121.5",
  "PSA.133.1", "PSA.139.14", "PSA.139.23", "PSA.143.10", "PSA.143.8", "PSA.145.18", "PSA.18.2", "PSA.23.3",
  "PSA.23.4", "PSA.23.6", "PSA.27.14", "PSA.27.4", "PSA.3.3", "PSA.31.24", "PSA.32.8", "PSA.34.14",
  "PSA.34.18", "PSA.34.19", "PSA.37.4", "PSA.4.8", "PSA.42.1", "PSA.42.11", "PSA.51.10", "PSA.56.3",
  "PSA.59.16", "PSA.68.19", "PSA.68.5", "PSA.8.3", "PSA.8.4", "PSA.84.5", "PSA.85.2", "PSA.9.1",
  "PSA.94.19", "REV.21.4", "REV.3.20", "REV.4.11", "ROM.1.16", "ROM.1.17", "ROM.10.13", "ROM.10.14",
  "ROM.10.17", "ROM.10.9", "ROM.12.1", "ROM.12.10", "ROM.12.12", "ROM.12.2", "ROM.12.21", "ROM.15.5",
  "ROM.3.23", "ROM.3.24", "ROM.5.1", "ROM.5.3", "ROM.5.4", "ROM.5.8", "ROM.8.1", "ROM.8.11",
  "ROM.8.18", "ROM.8.31", "ZEC.14.9", "ZEP.3.17",
];

async function fetchPage(usfm, lang, page) {
  const u = new URL(IMAGES_API);
  u.searchParams.append('usfm[]', usfm);
  u.searchParams.set('language_tag', lang);
  u.searchParams.set('category', 'prerendered_bg');
  u.searchParams.set('page', String(page));
  const r = await fetch(u, { headers: HEADERS });
  if (!r.ok) return { images: [], next: null };
  const j = await r.json();
  const d = j?.response?.data ?? {};
  return { images: d.images ?? [], next: d.next_page ?? null };
}

/** Full-resolution https URL from the templated `urls.regular`. */
function fullResUrl(img) {
  const tmpl = img?.urls?.regular;
  if (!tmpl) return null;
  const filled = tmpl.replace('{w}x{h}', `${img.width}x${img.height}`);
  return filled.startsWith('//') ? `https:${filled}` : filled;
}

async function main() {
  const { PrismaClient } = await import(`${ROOT}node_modules/@prisma/client/default.js`);
  const { put } = await import(`${ROOT}node_modules/@vercel/blob/dist/index.js`);
  const prisma = new PrismaClient();

  // 1. Existing prerendered_bg image ids (parsed from "… · <id>").
  const existing = await prisma.sharedAsset.findMany({
    where: { source: 'youversion', category: 'prerendered_bg' },
    select: { name: true },
  });
  const existingIds = new Set();
  for (const a of existing) {
    const m = a.name.match(/·\s*(\d+)\s*$/);
    if (m) existingIds.add(Number(m[1]));
  }
  console.log(`Existing prerendered_bg in DB: ${existing.length} (ids parsed: ${existingIds.size})`);
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'} · target=${TARGET} · limit=${LIMIT} · langs=${LANGS.join(',')}`);

  // 2. Gather unique new candidates until target reached.
  const seen = new Set(existingIds);
  const candidates = [];
  outer: for (const usfm of USFMS) {
    for (const lang of LANGS) {
      let page = 1;
      while (true) {
        const { images, next } = await fetchPage(usfm, lang, page);
        for (const img of images) {
          if (img.category !== 'prerendered_bg') continue;
          if (seen.has(img.id)) continue;
          const url = fullResUrl(img);
          if (!url) continue;
          seen.add(img.id);
          candidates.push({
            id: img.id,
            usfm,
            lang: img.language_tag || lang,
            width: img.width,
            height: img.height,
            orientation: img.height > img.width ? 'portrait' : 'landscape',
            url,
          });
          if (candidates.length >= TARGET) break outer;
        }
        if (!next) break;
        page = next;
      }
    }
  }

  const byLang = {};
  const byOrient = {};
  for (const c of candidates) {
    byLang[c.lang] = (byLang[c.lang] || 0) + 1;
    byOrient[c.orientation] = (byOrient[c.orientation] || 0) + 1;
  }
  console.log(`\nNew unique backgrounds discovered: ${candidates.length}`);
  console.log('  by language:', byLang);
  console.log('  by orientation:', byOrient);

  if (!COMMIT) {
    console.log('\nDRY-RUN — no writes. Re-run with --commit to upload + insert.');
    await prisma.$disconnect();
    return;
  }

  // 3. Download → Blob → DB, capped by --limit.
  const toWrite = candidates.slice(0, Math.min(candidates.length, LIMIT));
  console.log(`\nWriting ${toWrite.length} background(s) to prod Blob + DB…`);
  let ok = 0;
  for (const c of toWrite) {
    try {
      const resp = await fetch(c.url);
      if (!resp.ok) { console.log(`  skip ${c.id}: download HTTP ${resp.status}`); continue; }
      const buf = Buffer.from(await resp.arrayBuffer());
      const blob = await put(`verse-images/${c.lang}/prerendered_bg-${c.id}.jpg`, buf, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      await prisma.sharedAsset.create({
        data: {
          ownerId: 'verse-image-seed',
          ownerEmail: 'dan.luk@youversion.com',
          kind: 'image',
          name: `YouVersion · ${c.usfm} · ${c.lang} · ${c.id}`,
          fileUrl: blob.url,
          mime: 'image/jpeg',
          sizeBytes: buf.length,
          source: 'youversion',
          language: c.lang,
          category: 'prerendered_bg',
          orientation: c.orientation,
        },
      });
      ok++;
      if (ok % 20 === 0) console.log(`  …${ok}/${toWrite.length}`);
    } catch (e) {
      console.log(`  error ${c.id}: ${e.message}`);
    }
  }
  console.log(`\nDone. Inserted ${ok} background(s).`);

  const total = await prisma.sharedAsset.count({ where: { source: 'youversion', category: 'prerendered_bg' } });
  console.log(`Total prerendered_bg in DB now: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
