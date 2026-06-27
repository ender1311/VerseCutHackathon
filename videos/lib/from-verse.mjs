#!/usr/bin/env node
// Generate a HyperFrames product-marketing composition from a Bible verse.
// Fetches verse text from YouVersion's internal reader API (no key) and writes a
// self-contained composition (index.html + beats.json + config) into an output dir.
//
// Usage:
//   node videos/lib/from-verse.mjs --version 111 --ref JHN.3.16-17 \
//     --reference "John 3:16-17" --cta "Download the Bible App!" --out videos/verse-promo
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const version = arg('version', '111'); // 111 = NIV
const ref = arg('ref', 'JHN.3.16-17'); // USFM: BOOK.CH.V or BOOK.CH.FROM-TO
const cta = arg('cta', 'Download the Bible App!');
const outDir = resolve(arg('out', 'videos/verse-promo'));

const INTERNAL = 'https://bible.youversionapi.com/3.1';
const HEADERS = {
  Referer: 'http://yvapi.youversionapi.com',
  'X-YouVersion-Client': 'youversion',
  'X-YouVersion-App-Platform': 'internal',
  'X-YouVersion-App-Version': '1',
  Accept: 'application/json',
};

function parseRef(usfm) {
  // BOOK.CH.FROM[-TO]
  const m = usfm.match(/^([1-3]?[A-Z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Bad --ref "${usfm}" (expected e.g. JHN.3.16-17)`);
  return { book: m[1], chapter: +m[2], from: +m[3], to: m[4] ? +m[4] : +m[3] };
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Extract verses [from..to] from chapter HTML using data-usfm spans + .content.
function extractVerses(html, book, chapter, from, to) {
  const parts = [];
  for (let v = from; v <= to; v++) {
    const usfm = `${book}.${chapter}.${v}`;
    // Grab the verse container, then its .content spans.
    const re = new RegExp(`data-usfm="${usfm.replace(/\./g, '\\.')}"[\\s\\S]*?(?=data-usfm="|$)`, 'g');
    const block = (html.match(re) || []).join(' ');
    const contents = [...block.matchAll(/class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
      .map((mm) => stripTags(mm[1]))
      .join(' ');
    const text = (contents || stripTags(block)).replace(/^\d+\s*/, '').trim();
    if (text) parts.push(text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  const parts = text.match(/[^.!?;]+[.!?;]?/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Fraunces:ital,opsz,wght@0,9..144,500..600;1,9..144,500&display=swap" rel="stylesheet" />
    <style>
      :root { --teal:#33514b; --muted:#5b6b68; --ink:#1a1a1a; --brand:#fe3745; }
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { width:1080px; height:1920px; overflow:hidden;
        font-family:'Plus Jakarta Sans',system-ui,sans-serif;
        background:linear-gradient(180deg,#eef4fb,#cfe0ef); }
      .scene { position:absolute; inset:0; display:flex; flex-direction:column;
        justify-content:center; padding:120px 92px;
        background:linear-gradient(180deg,#eef4fb,#cfe0ef); }
      .verse { font-family:'Fraunces',Georgia,serif; font-weight:600; color:var(--teal);
        font-size:78px; line-height:1.32; }
      .ref { margin-top:40px; font-size:38px; font-weight:600; color:var(--muted); }
      .hook { font-family:'Fraunces',Georgia,serif; font-weight:600; color:var(--teal);
        font-size:96px; line-height:1.2; text-align:center; }
      .cta { font-size:60px; font-weight:800; color:var(--ink); text-align:center; }
      .lockup { display:flex; align-items:center; justify-content:center; gap:24px; margin-top:56px; }
      .mark { width:96px; height:96px; border-radius:26px; background:var(--brand);
        display:flex; align-items:center; justify-content:center; color:#fff; font-family:'Fraunces',serif;
        font-size:24px; font-weight:600; }
      .word { font-size:64px; font-weight:800; color:var(--ink); }
      #cap { position:absolute; left:92px; right:92px; bottom:150px; text-align:center;
        font-size:40px; font-weight:700; color:var(--ink); opacity:0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="12"
         data-width="1080" data-height="1920">
      <div id="scene1" class="scene"><div class="hook">__REFERENCE__</div></div>
      <div id="scene2" class="scene">
        <div class="verse">“__VERSE__”</div>
        <div class="ref">__REFERENCE__</div>
      </div>
      <div id="scene3" class="scene">
        <div class="cta">__CTA__</div>
        <div class="lockup"><div class="mark">✝</div><div class="word">Bible App</div></div>
      </div>
      <div id="cap"></div>
      <audio id="vo" src="narration.wav" data-start="0" data-duration="12" data-track-index="9"></audio>
    </div>
    <script src="timings.js"></script>
    <script>
      const T = window.__VIDEO_TIMINGS;
      const tl = gsap.timeline({ paused: true });
      const ids = Object.keys(T.scenes).map(Number).sort((a,b)=>a-b);
      ids.forEach((id) => { gsap.set('#scene'+id, { autoAlpha: 0 }); });
      ids.forEach((id) => {
        const s = T.scenes[id];
        tl.to('#scene'+id, { autoAlpha: 1, duration: 0.5 }, s.fadeStart);
        if (s.hideAt != null) tl.to('#scene'+id, { autoAlpha: 0, duration: 0.5 }, s.hideAt);
      });
      const cap = document.getElementById('cap');
      T.beats.forEach((b) => {
        tl.call(() => { cap.textContent = b.text; }, [], b.start);
        tl.to('#cap', { autoAlpha: 1, duration: 0.2 }, b.start);
        tl.to('#cap', { autoAlpha: 0, duration: 0.2 }, b.end);
      });
      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
    </script>
  </body>
</html>`;

async function main() {
  const { book, chapter, from, to } = parseRef(ref);
  const url = `${INTERNAL}/chapter.json?id=${version}&reference=${book}.${chapter}&format=html`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`chapter.json ${res.status}`);
  const data = (await res.json())?.response?.data ?? {};
  const verse = extractVerses(data.content ?? '', book, chapter, from, to);
  if (!verse) throw new Error('No verse text extracted');
  const reference = arg('reference', (data.reference?.human ?? `${book} ${chapter}`) + `:${from}${to > from ? '-' + to : ''}`);

  const beats = [
    { scene: 1, text: reference },
    ...splitSentences(verse).map((s) => ({ scene: 2, text: s })),
    { scene: 3, text: cta },
  ];

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/beats.json`, JSON.stringify(beats, null, 2));
  writeFileSync(
    `${outDir}/index.html`,
    html.replaceAll('__VERSE__', verse).replaceAll('__REFERENCE__', reference).replaceAll('__CTA__', cta),
  );
  writeFileSync(`${outDir}/hyperframes.json`, JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json' }, null, 2));
  writeFileSync(`${outDir}/meta.json`, JSON.stringify({ id: 'verse-promo', name: 'verse-promo' }, null, 2));
  writeFileSync(
    `${outDir}/package.json`,
    JSON.stringify(
      { name: 'verse-promo', private: true, type: 'module', scripts: { render: 'npx --yes hyperframes@0.6.112 render' } },
      null,
      2,
    ),
  );
  console.log(`✓ wrote composition → ${outDir}\n  ${beats.length} beats · verse: "${verse.slice(0, 60)}…"`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
