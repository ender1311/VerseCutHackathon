# Bulk Version Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bulk Export tab that renders a branded verse asset for every catalog version, uploads each to AIR, and downloads three CSVs (versions + geo backgrounds by-country and by-language).

**Architecture:** Client-driven batch reusing the existing `renderImage` Canvas pipeline; a server-only route ports the AIR (air.inc) upload flow so credentials never reach the browser. Pure helpers (CSV, geo safety/mapping, logo resolution, orchestration) live in `src/lib/export/` and are unit-tested; the `/export` route hosts a client shell that wires them together.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, Vitest, Node global `fetch`, existing Unsplash + internal-Bible + Canvas render stack.

## Global Constraints

- No `any` — use `unknown` + narrowing.
- New pure functions in `lib/` get a `*.test.ts` beside them.
- `npm run check` (typecheck + lint + tests) must pass before every push.
- Secrets are server-only env, never `NEXT_PUBLIC_*`. AIR keys are read only in server modules.
- Verse **text/reference** always flow through the internal reader API (never the license-scoped Platform API).
- Logo rule: covered languages (the 66 with art) use the chosen style; every other version uses English `icon-only` (no wordmark), never a lockup.
- Branch note: this plan's branch (`feat/bulk-version-export`) is based on `main`, which still contains the `/product` tab. PR #7 removes it. Adding `/export` to `SpaceSwitcher` here will create a trivial merge conflict with PR #7 on that one array — resolve by keeping `/` , `/social`, `/export` (drop `/product`). Non-blocking.

---

### Task 1: Export types + CSV builders

**Files:**
- Create: `src/lib/export/types.ts`
- Create: `src/lib/export/csv.ts`
- Test: `src/lib/export/csv.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface VersionExportRow { version_id: string; reference: string; verse_text: string; air_cdn_link: string }`
  - `interface GeoImage { url: string; credit: string }`
  - `interface GeoResult { country: string; capital: string; images: GeoImage[]; languages: { code: string; name: string }[] }`
  - `function csvCell(value: string): string`
  - `function toCsv(headers: string[], rows: string[][]): string`
  - `function buildVersionsCsv(rows: VersionExportRow[]): string`
  - `function buildGeoByCountryCsv(results: GeoResult[]): string`
  - `function buildGeoByLanguageCsv(results: GeoResult[]): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  csvCell,
  toCsv,
  buildVersionsCsv,
  buildGeoByCountryCsv,
  buildGeoByLanguageCsv,
} from './csv';
import type { GeoResult, VersionExportRow } from './types';

describe('csvCell', () => {
  it('passes plain values through', () => {
    expect(csvCell('John 3:16')).toBe('John 3:16');
  });
  it('quotes and escapes commas, quotes, and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with CRLF and a trailing newline', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2\r\n');
  });
});

describe('buildVersionsCsv', () => {
  it('emits the four columns and escapes verse text', () => {
    const rows: VersionExportRow[] = [
      { version_id: '111', reference: 'John 3:16', verse_text: 'For God, so "loved"', air_cdn_link: 'https://cdn/x.jpg' },
    ];
    expect(buildVersionsCsv(rows)).toBe(
      'version_id,reference,verse_text,air_cdn_link\r\n111,John 3:16,"For God, so ""loved""",https://cdn/x.jpg\r\n',
    );
  });
});

const GEO: GeoResult[] = [
  {
    country: 'France',
    capital: 'Paris',
    images: [
      { url: 'https://img/a.jpg', credit: 'Ann / Unsplash' },
      { url: 'https://img/b.jpg', credit: 'Bo / Unsplash' },
    ],
    languages: [
      { code: 'fr', name: 'French' },
      { code: 'br', name: 'Breton' },
    ],
  },
];

describe('buildGeoByCountryCsv', () => {
  it('joins images per country row', () => {
    expect(buildGeoByCountryCsv(GEO)).toBe(
      'country,capital,image_urls,unsplash_credits\r\n' +
        'France,Paris,https://img/a.jpg | https://img/b.jpg,Ann / Unsplash | Bo / Unsplash\r\n',
    );
  });
});

describe('buildGeoByLanguageCsv', () => {
  it('emits one row per language pointing at the country images', () => {
    expect(buildGeoByLanguageCsv(GEO)).toBe(
      'language,language_name,country,image_urls,unsplash_credits\r\n' +
        'fr,French,France,https://img/a.jpg | https://img/b.jpg,Ann / Unsplash | Bo / Unsplash\r\n' +
        'br,Breton,France,https://img/a.jpg | https://img/b.jpg,Ann / Unsplash | Bo / Unsplash\r\n',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/csv.test.ts`
Expected: FAIL — `Failed to resolve import "./csv"`.

- [ ] **Step 3: Write the types**

Create `src/lib/export/types.ts`:

```ts
export interface VersionExportRow {
  version_id: string;
  reference: string;
  verse_text: string;
  air_cdn_link: string;
}

export interface GeoImage {
  url: string;
  credit: string;
}

export interface GeoResult {
  country: string;
  capital: string;
  images: GeoImage[];
  languages: { code: string; name: string }[];
}
```

- [ ] **Step 4: Write the CSV builders**

Create `src/lib/export/csv.ts`:

```ts
import type { GeoResult, VersionExportRow } from './types';

const IMG_JOIN = ' | ';

/** RFC-4180: quote a field containing comma, quote, CR, or LF; double quotes. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function buildVersionsCsv(rows: VersionExportRow[]): string {
  return toCsv(
    ['version_id', 'reference', 'verse_text', 'air_cdn_link'],
    rows.map((r) => [r.version_id, r.reference, r.verse_text, r.air_cdn_link]),
  );
}

export function buildGeoByCountryCsv(results: GeoResult[]): string {
  return toCsv(
    ['country', 'capital', 'image_urls', 'unsplash_credits'],
    results.map((g) => [
      g.country,
      g.capital,
      g.images.map((i) => i.url).join(IMG_JOIN),
      g.images.map((i) => i.credit).join(IMG_JOIN),
    ]),
  );
}

export function buildGeoByLanguageCsv(results: GeoResult[]): string {
  const rows: string[][] = [];
  for (const g of results) {
    const urls = g.images.map((i) => i.url).join(IMG_JOIN);
    const credits = g.images.map((i) => i.credit).join(IMG_JOIN);
    for (const lang of g.languages) {
      rows.push([lang.code, lang.name, g.country, urls, credits]);
    }
  }
  return toCsv(['language', 'language_name', 'country', 'image_urls', 'unsplash_credits'], rows);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/export/csv.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/types.ts src/lib/export/csv.ts src/lib/export/csv.test.ts
git commit -m "feat: add export types and CSV builders"
```

---

### Task 2: Geo safety filter

**Files:**
- Create: `src/lib/export/geoSafety.ts`
- Test: `src/lib/export/geoSafety.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `function isSafeGeoPhoto(photo: { description: string | null }): boolean`

Rationale: geo backgrounds must be neutral landmarks. Reject any photo whose description matches religious (any faith), political, or conflict terms. "Flag" is not blocked (flags are usually fine); a flag photo that is also religious/political is caught by those terms.

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/geoSafety.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isSafeGeoPhoto } from './geoSafety';

describe('isSafeGeoPhoto', () => {
  it('accepts neutral landmarks', () => {
    expect(isSafeGeoPhoto({ description: 'Eiffel Tower at sunset' })).toBe(true);
    expect(isSafeGeoPhoto({ description: 'Tokyo skyline at night' })).toBe(true);
    expect(isSafeGeoPhoto({ description: null })).toBe(true);
  });
  it('rejects religious imagery of any faith', () => {
    expect(isSafeGeoPhoto({ description: 'Notre-Dame cathedral church' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'A mosque at dawn' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'Hindu temple' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'people at prayer' })).toBe(false);
  });
  it('rejects political and conflict imagery', () => {
    expect(isSafeGeoPhoto({ description: 'street protest against the election' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'soldiers with weapons at war' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/geoSafety.test.ts`
Expected: FAIL — cannot resolve `./geoSafety`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/export/geoSafety.ts`:

```ts
// Neutral-landmark filter for geo backgrounds. Reject religious (any faith),
// political, or conflict imagery by scanning the photo description.
const BLOCKED_TERMS = [
  // religion (all faiths — geo backgrounds should be neutral)
  'church', 'cathedral', 'mosque', 'synagogue', 'temple', 'shrine', 'chapel',
  'worship', 'prayer', 'pray', 'religion', 'religious', 'holy', 'sacred',
  'cross', 'crucifix', 'buddha', 'buddhist', 'hindu', 'islam', 'islamic',
  'muslim', 'christian', 'christ', 'jesus', 'bible', 'quran', 'koran', 'torah',
  'monk', 'nun', 'priest', 'imam', 'rabbi',
  // politics + conflict
  'protest', 'politic', 'election', 'riot', 'war', 'military', 'soldier',
  'weapon', 'gun', 'army', 'battle', 'demonstration',
];

export function isSafeGeoPhoto(photo: { description: string | null }): boolean {
  const text = (photo.description ?? '').toLowerCase();
  return !BLOCKED_TERMS.some((term) => text.includes(term));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/geoSafety.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/geoSafety.ts src/lib/export/geoSafety.test.ts
git commit -m "feat: add neutral-landmark geo safety filter"
```

---

### Task 3: Language→country map + geo result builder

**Files:**
- Create: `src/lib/export/languageCountry.ts`
- Create: `src/lib/export/geoBackgrounds.ts`
- Test: `src/lib/export/geoBackgrounds.test.ts`

**Interfaces:**
- Consumes: `isSafeGeoPhoto` (Task 2); `GeoResult`, `GeoImage` (Task 1).
- Produces:
  - `interface CountryInfo { country: string; capital: string }`
  - `const LANGUAGE_COUNTRY: Record<string, CountryInfo>`
  - `interface RawGeoPhoto { description: string | null; urls: { regular: string }; user: { name: string } }`
  - `function planGeoQueries(info: CountryInfo): string[]`
  - `function buildGeoResults(languages: { code: string; name: string }[], photosByCountry: Map<string, RawGeoPhoto[]>, opts?: { maxImages?: number }): GeoResult[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/geoBackgrounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planGeoQueries, buildGeoResults, type RawGeoPhoto } from './geoBackgrounds';
import { LANGUAGE_COUNTRY } from './languageCountry';

describe('planGeoQueries', () => {
  it('produces landmark-focused queries for a country', () => {
    const q = planGeoQueries({ country: 'France', capital: 'Paris' });
    expect(q).toContain('France landmark');
    expect(q).toContain('Paris skyline');
  });
});

const photo = (desc: string | null, url: string, name = 'Ann'): RawGeoPhoto => ({
  description: desc,
  urls: { regular: url },
  user: { name },
});

describe('buildGeoResults', () => {
  it('groups languages by country, filters unsafe, dedupes, caps, and credits', () => {
    const photosByCountry = new Map<string, RawGeoPhoto[]>([
      [
        'France',
        [
          photo('Eiffel Tower', 'https://img/a.jpg'),
          photo('cathedral interior', 'https://img/relig.jpg'), // filtered out
          photo('Louvre', 'https://img/a.jpg'), // duplicate url
          photo('Nice coastline', 'https://img/b.jpg', 'Bo'),
          photo('Lyon street', 'https://img/c.jpg'), // beyond cap of 2
        ],
      ],
    ]);
    const res = buildGeoResults(
      [
        { code: 'fr', name: 'French' },
        { code: 'br', name: 'Breton' }, // must also map to France
        { code: 'zz-nomap', name: 'Nowhere' }, // omitted (no country)
      ],
      photosByCountry,
      { maxImages: 2 },
    );
    expect(res).toHaveLength(1);
    expect(res[0].country).toBe('France');
    expect(res[0].images.map((i) => i.url)).toEqual(['https://img/a.jpg', 'https://img/b.jpg']);
    expect(res[0].images[0].credit).toBe('Ann / Unsplash');
    expect(res[0].languages.map((l) => l.code).sort()).toEqual(['br', 'fr']);
  });
});

describe('LANGUAGE_COUNTRY', () => {
  it('maps major languages including Breton to France', () => {
    expect(LANGUAGE_COUNTRY.fr.country).toBe('France');
    expect(LANGUAGE_COUNTRY.br.country).toBe('France');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/geoBackgrounds.test.ts`
Expected: FAIL — cannot resolve `./geoBackgrounds` / `./languageCountry`.

- [ ] **Step 3: Write the language→country map**

Create `src/lib/export/languageCountry.ts`. This is a curated seed for confidently-mappable languages; the long tail is intentionally absent (those rows are omitted from the geo CSVs and logged by the caller). Extend as needed.

```ts
export interface CountryInfo {
  country: string;
  capital: string;
}

// Curated language(iso)→primary country for geo targeting. Approximate by design;
// only confident mappings are included. Keys match manifest language `code`.
export const LANGUAGE_COUNTRY: Record<string, CountryInfo> = {
  en: { country: 'United States', capital: 'Washington' },
  es: { country: 'Spain', capital: 'Madrid' },
  'es-LA': { country: 'Mexico', capital: 'Mexico City' },
  pt: { country: 'Portugal', capital: 'Lisbon' },
  'pt-BR': { country: 'Brazil', capital: 'Brasilia' },
  'pt-PT': { country: 'Portugal', capital: 'Lisbon' },
  fr: { country: 'France', capital: 'Paris' },
  br: { country: 'France', capital: 'Paris' },
  de: { country: 'Germany', capital: 'Berlin' },
  it: { country: 'Italy', capital: 'Rome' },
  nl: { country: 'Netherlands', capital: 'Amsterdam' },
  ru: { country: 'Russia', capital: 'Moscow' },
  uk: { country: 'Ukraine', capital: 'Kyiv' },
  pl: { country: 'Poland', capital: 'Warsaw' },
  cs: { country: 'Czech Republic', capital: 'Prague' },
  sk: { country: 'Slovakia', capital: 'Bratislava' },
  hu: { country: 'Hungary', capital: 'Budapest' },
  ro: { country: 'Romania', capital: 'Bucharest' },
  bg: { country: 'Bulgaria', capital: 'Sofia' },
  el: { country: 'Greece', capital: 'Athens' },
  sv: { country: 'Sweden', capital: 'Stockholm' },
  no: { country: 'Norway', capital: 'Oslo' },
  da: { country: 'Denmark', capital: 'Copenhagen' },
  fi: { country: 'Finland', capital: 'Helsinki' },
  is: { country: 'Iceland', capital: 'Reykjavik' },
  ca: { country: 'Spain', capital: 'Barcelona' },
  hr: { country: 'Croatia', capital: 'Zagreb' },
  sl: { country: 'Slovenia', capital: 'Ljubljana' },
  sq: { country: 'Albania', capital: 'Tirana' },
  mk: { country: 'North Macedonia', capital: 'Skopje' },
  lt: { country: 'Lithuania', capital: 'Vilnius' },
  lv: { country: 'Latvia', capital: 'Riga' },
  be: { country: 'Belarus', capital: 'Minsk' },
  cy: { country: 'United Kingdom', capital: 'Cardiff' },
  tr: { country: 'Turkey', capital: 'Istanbul' },
  ar: { country: 'Egypt', capital: 'Cairo' },
  fa: { country: 'Iran', capital: 'Tehran' },
  he: { country: 'Israel', capital: 'Jerusalem' },
  hi: { country: 'India', capital: 'New Delhi' },
  ta: { country: 'India', capital: 'Chennai' },
  te: { country: 'India', capital: 'Hyderabad' },
  ml: { country: 'India', capital: 'Kochi' },
  ur: { country: 'Pakistan', capital: 'Islamabad' },
  th: { country: 'Thailand', capital: 'Bangkok' },
  vi: { country: 'Vietnam', capital: 'Hanoi' },
  km: { country: 'Cambodia', capital: 'Phnom Penh' },
  my: { country: 'Myanmar', capital: 'Yangon' },
  'my-mm': { country: 'Myanmar', capital: 'Yangon' },
  id: { country: 'Indonesia', capital: 'Jakarta' },
  ms: { country: 'Malaysia', capital: 'Kuala Lumpur' },
  fl: { country: 'Philippines', capital: 'Manila' },
  ja: { country: 'Japan', capital: 'Tokyo' },
  kor: { country: 'South Korea', capital: 'Seoul' },
  ko: { country: 'South Korea', capital: 'Seoul' },
  'zh-CN': { country: 'China', capital: 'Beijing' },
  'zh-TW': { country: 'Taiwan', capital: 'Taipei' },
  'zh-HK': { country: 'Hong Kong', capital: 'Hong Kong' },
  mn: { country: 'Mongolia', capital: 'Ulaanbaatar' },
  ne: { country: 'Nepal', capital: 'Kathmandu' },
  'ne-NP': { country: 'Nepal', capital: 'Kathmandu' },
  hy: { country: 'Armenia', capital: 'Yerevan' },
  ka: { country: 'Georgia', capital: 'Tbilisi' },
  sw: { country: 'Kenya', capital: 'Nairobi' },
  zu: { country: 'South Africa', capital: 'Johannesburg' },
  af: { country: 'South Africa', capital: 'Cape Town' },
  sn: { country: 'Zimbabwe', capital: 'Harare' },
  yo: { country: 'Nigeria', capital: 'Lagos' },
  ig: { country: 'Nigeria', capital: 'Abuja' },
  ht: { country: 'Haiti', capital: 'Port-au-Prince' },
  ku: { country: 'Iraq', capital: 'Erbil' },
};
```

- [ ] **Step 4: Write the geo result builder**

Create `src/lib/export/geoBackgrounds.ts`:

```ts
import { isSafeGeoPhoto } from './geoSafety';
import { LANGUAGE_COUNTRY, type CountryInfo } from './languageCountry';
import type { GeoImage, GeoResult } from './types';

export interface RawGeoPhoto {
  description: string | null;
  urls: { regular: string };
  user: { name: string };
}

/** Landmark-focused Unsplash queries for a country. */
export function planGeoQueries(info: CountryInfo): string[] {
  return [
    `${info.country} landmark`,
    `${info.capital} skyline`,
    `${info.country} architecture`,
  ];
}

/**
 * Group languages by their mapped country and attach that country's safe,
 * deduped, capped images. Languages with no country mapping are omitted (the
 * caller logs how many were dropped).
 */
export function buildGeoResults(
  languages: { code: string; name: string }[],
  photosByCountry: Map<string, RawGeoPhoto[]>,
  opts: { maxImages?: number } = {},
): GeoResult[] {
  const maxImages = opts.maxImages ?? 3;
  const byCountry = new Map<string, { info: CountryInfo; languages: { code: string; name: string }[] }>();

  for (const lang of languages) {
    const info = LANGUAGE_COUNTRY[lang.code];
    if (!info) continue;
    const entry = byCountry.get(info.country) ?? { info, languages: [] };
    entry.languages.push(lang);
    byCountry.set(info.country, entry);
  }

  const results: GeoResult[] = [];
  for (const [country, { info, languages: langs }] of byCountry) {
    const photos = photosByCountry.get(country) ?? [];
    const seen = new Set<string>();
    const images: GeoImage[] = [];
    for (const p of photos) {
      if (!isSafeGeoPhoto(p)) continue;
      if (seen.has(p.urls.regular)) continue;
      seen.add(p.urls.regular);
      images.push({ url: p.urls.regular, credit: `${p.user.name} / Unsplash` });
      if (images.length >= maxImages) break;
    }
    results.push({ country, capital: info.capital, images, languages: langs });
  }
  return results;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/export/geoBackgrounds.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/languageCountry.ts src/lib/export/geoBackgrounds.ts src/lib/export/geoBackgrounds.test.ts
git commit -m "feat: add language-country map and geo result builder"
```

---

### Task 4: Bulk logo resolver

**Files:**
- Create: `src/lib/export/logo.ts`
- Test: `src/lib/export/logo.test.ts`

**Interfaces:**
- Consumes: `resolveLogoFile` from `src/lib/logoAssets.ts`; `LogoStyle` from `src/lib/iconCatalog.ts`.
- Produces:
  - `interface BulkLogo { languageId: string; logoStyle: LogoStyle }`
  - `function resolveBulkLogo(code: string, chosenStyle: LogoStyle): BulkLogo`

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/logo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveBulkLogo } from './logo';

describe('resolveBulkLogo', () => {
  it('keeps the chosen style for a covered language', () => {
    expect(resolveBulkLogo('es', 'logo-light')).toEqual({ languageId: 'es', logoStyle: 'logo-light' });
    expect(resolveBulkLogo('fr', 'icon-only')).toEqual({ languageId: 'fr', logoStyle: 'icon-only' });
  });
  it('falls back to English icon-only for an uncovered language', () => {
    expect(resolveBulkLogo('aau', 'logo-light')).toEqual({ languageId: 'en', logoStyle: 'icon-only' });
    expect(resolveBulkLogo('acr', 'logo-dark')).toEqual({ languageId: 'en', logoStyle: 'icon-only' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/logo.test.ts`
Expected: FAIL — cannot resolve `./logo`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/export/logo.ts`:

```ts
import type { LogoStyle } from '../iconCatalog';
import { resolveLogoFile } from '../logoAssets';

export interface BulkLogo {
  languageId: string;
  logoStyle: LogoStyle;
}

/**
 * Covered languages (those with localized art) render in the chosen style.
 * Everything else uses the English icon-only mark — the plain app icon with no
 * "Bible App" wordmark — never a lockup.
 */
export function resolveBulkLogo(code: string, chosenStyle: LogoStyle): BulkLogo {
  if (resolveLogoFile(chosenStyle, code)) {
    return { languageId: code, logoStyle: chosenStyle };
  }
  return { languageId: 'en', logoStyle: 'icon-only' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/logo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/logo.ts src/lib/export/logo.test.ts
git commit -m "feat: add bulk logo resolver with English icon-only fallback"
```

---

### Task 5: AIR server upload module

**Files:**
- Create: `src/lib/server/air.ts`
- Test: `src/lib/server/air.test.ts`

**Interfaces:**
- Consumes: nothing (Node `fetch`).
- Produces:
  - `interface AirEnv { apiKey: string; workspaceId: string; parentBoardId?: string; baseUrl: string }`
  - `function getAirEnv(): AirEnv | null`
  - `function uploadToAir(bytes: Uint8Array, opts: { fileName: string; mime: string; env: AirEnv; fetchImpl?: typeof fetch }): Promise<{ cdnUrl: string }>`

Ports `/Users/danluk/repos/alfred/air_upload/client.py`: `POST /v1/uploads` → `PUT` bytes to the presigned `uploadUrl` → `POST /v1/assets/{assetId}/cdnLinks` (poll through 404). Best-URL order: cdn link → version preview → `https://air-prod.imgix.net/{versionId}.jpg`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/air.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { uploadToAir, type AirEnv } from './air';

const ENV: AirEnv = {
  apiKey: 'k',
  workspaceId: 'w',
  baseUrl: 'https://api.air.inc',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('uploadToAir', () => {
  it('registers, PUTs bytes, creates a cdn link, and returns the cdn url', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? 'GET'} ${u}`);
      if (u.endsWith('/v1/uploads')) {
        return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v1' });
      }
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) return jsonResponse({ id: 'c1', url: 'https://cdn.air/x.jpg' });
      if (u.includes('/versions/')) return jsonResponse({ urls: { preview: 'https://prev/x.jpg' } });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1, 2, 3]), {
      fileName: 'v1.png',
      mime: 'image/png',
      env: ENV,
      fetchImpl,
    });
    expect(res.cdnUrl).toBe('https://cdn.air/x.jpg');
    expect(calls[0]).toBe('POST https://api.air.inc/v1/uploads');
    expect(calls[1]).toBe('PUT https://s3/put');
  });

  it('falls back to the imgix version URL when no cdn link is returned', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/uploads')) return jsonResponse({ uploadUrl: 'https://s3/put', assetId: 'a1', versionId: 'v9' });
      if (u === 'https://s3/put') return new Response(null, { status: 200 });
      if (u.includes('/cdnLinks')) return jsonResponse({}, 500);
      if (u.includes('/versions/')) return jsonResponse({}, 500);
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const res = await uploadToAir(new Uint8Array([1]), { fileName: 'v9.png', mime: 'image/png', env: ENV, fetchImpl });
    expect(res.cdnUrl).toBe('https://air-prod.imgix.net/v9.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/air.test.ts`
Expected: FAIL — cannot resolve `./air`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/air.ts`:

```ts
export interface AirEnv {
  apiKey: string;
  workspaceId: string;
  parentBoardId?: string;
  baseUrl: string;
}

export function getAirEnv(): AirEnv | null {
  const apiKey = process.env.AIR_API_KEY;
  const workspaceId = process.env.AIR_WORKSPACE_ID;
  if (!apiKey || !workspaceId) return null;
  return {
    apiKey,
    workspaceId,
    parentBoardId: process.env.AIR_PARENT_BOARD_ID || undefined,
    baseUrl: (process.env.AIR_API_BASE_URL || 'https://api.air.inc').replace(/\/$/, ''),
  };
}

function airHeaders(env: AirEnv): Record<string, string> {
  return { 'x-api-key': env.apiKey, 'x-air-workspace-id': env.workspaceId };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST that polls through 404 (asset version not yet ready) with capped backoff. */
async function postWhenReady(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Response> {
  const deadline = Date.now() + 45_000;
  let backoff = 350;
  const payload = JSON.stringify(body);
  for (;;) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok || res.status !== 404 || Date.now() >= deadline) return res;
    await sleep(backoff);
    backoff = Math.min(backoff * 1.65, 2750);
  }
}

interface UploadRegistration {
  uploadUrl?: string;
  assetId?: string;
  versionId?: string;
}

export async function uploadToAir(
  bytes: Uint8Array,
  opts: { fileName: string; mime: string; env: AirEnv; fetchImpl?: typeof fetch },
): Promise<{ cdnUrl: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { env } = opts;
  const headers = airHeaders(env);

  const stem = opts.fileName.replace(/\.[^.]+$/, '');
  const ext = opts.fileName.includes('.') ? opts.fileName.split('.').pop()! : '';
  const regBody: Record<string, unknown> = {
    fileName: stem,
    ext,
    size: bytes.byteLength,
    mime: opts.mime,
    recordedAt: '1970-01-01T00:00:00Z',
  };
  if (env.parentBoardId) regBody.parentBoardId = env.parentBoardId;

  const regRes = await fetchImpl(`${env.baseUrl}/v1/uploads`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(regBody),
  });
  if (!regRes.ok) throw new Error(`AIR /v1/uploads failed (${regRes.status})`);
  const reg = (await regRes.json()) as UploadRegistration;
  if (!reg.uploadUrl || !reg.assetId || !reg.versionId) {
    throw new Error('AIR /v1/uploads: missing uploadUrl/assetId/versionId');
  }

  const putRes = await fetchImpl(reg.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': opts.mime },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`AIR upload PUT failed (${putRes.status})`);

  const cdnRes = await postWhenReady(
    fetchImpl,
    `${env.baseUrl}/v1/assets/${reg.assetId}/cdnLinks`,
    headers,
    { versionId: reg.versionId },
  );
  if (cdnRes.ok) {
    const cdn = (await cdnRes.json()) as { url?: string };
    if (cdn.url) return { cdnUrl: cdn.url };
  }

  const verRes = await fetchImpl(
    `${env.baseUrl}/v1/assets/${reg.assetId}/versions/${reg.versionId}`,
    { headers },
  );
  if (verRes.ok) {
    const ver = (await verRes.json()) as { urls?: { preview?: string; thumbnail?: string } };
    const preview = ver.urls?.preview ?? ver.urls?.thumbnail;
    if (preview) return { cdnUrl: preview };
  }

  return { cdnUrl: `https://air-prod.imgix.net/${reg.versionId}.jpg` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/air.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/air.ts src/lib/server/air.test.ts
git commit -m "feat: port AIR upload flow to a server module"
```

---

### Task 6: AIR upload route + client helper

**Files:**
- Create: `src/app/api/air/upload/route.ts`
- Create: `src/lib/export/airClient.ts`

**Interfaces:**
- Consumes: `getAirEnv`, `uploadToAir` (Task 5).
- Produces:
  - `POST /api/air/upload` — multipart `file` → `{ data: { cdnUrl } }` | `{ error }` (503 when unconfigured).
  - `function uploadImageToAir(blob: Blob, fileName: string): Promise<string>` (client).

- [ ] **Step 1: Write the route**

Create `src/app/api/air/upload/route.ts`:

```ts
import { getAirEnv, uploadToAir } from '@/lib/server/air';

export async function POST(request: Request) {
  const env = getAirEnv();
  if (!env) {
    return Response.json({ error: 'AIR is not configured (missing AIR_API_KEY/AIR_WORKSPACE_ID)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const { cdnUrl } = await uploadToAir(bytes, {
      fileName: file.name || 'asset.png',
      mime: file.type || 'image/png',
      env,
    });
    return Response.json({ data: { cdnUrl } });
  } catch {
    return Response.json({ error: 'AIR upload failed' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Write the client helper**

Create `src/lib/export/airClient.ts`:

```ts
/** Upload an image blob to AIR via the server proxy; returns the CDN URL. */
export async function uploadImageToAir(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, fileName);
  const res = await fetch('/api/air/upload', { method: 'POST', body: form });
  const json = (await res.json()) as { data?: { cdnUrl: string }; error?: string };
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? `AIR upload failed (${res.status})`);
  }
  return json.data.cdnUrl;
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/air/upload/route.ts src/lib/export/airClient.ts
git commit -m "feat: add AIR upload route and client helper"
```

---

### Task 7: Version export orchestrator

**Files:**
- Create: `src/lib/export/versionExport.ts`
- Test: `src/lib/export/versionExport.test.ts`

**Interfaces:**
- Consumes: `RenderInput`, `RenderedAsset` from `src/lib/render.ts`; `Passage`, `PassageQuery` from `src/lib/bible`; `LogoStyle` from `src/lib/iconCatalog`; `resolveBulkLogo` (Task 4); `VersionExportRow` (Task 1).
- Produces:
  - `interface ExportVersion { id: string; code: string }`
  - `interface VersionExportDeps { fetchPassage; renderImage; uploadImage }`
  - `interface VersionExportOptions { … }`
  - `function runVersionExport(versions: ExportVersion[], deps: VersionExportDeps, opts: VersionExportOptions): Promise<VersionExportRow[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/versionExport.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runVersionExport, type VersionExportDeps } from './versionExport';

const baseOpts = {
  reference: { bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 },
  aspect: '1:1' as const,
  dimensions: { width: 1080, height: 1080 },
  logoStyle: 'logo-light' as const,
  gradientId: 'ocean',
  concurrency: 2,
};

function makeDeps(overrides: Partial<VersionExportDeps> = {}): VersionExportDeps {
  return {
    fetchPassage: vi.fn(async (q) => ({
      reference: `ref-${q.versionId}`,
      text: `text-${q.versionId}`,
      versionAbbreviation: q.versionId,
    })),
    renderImage: vi.fn(async () => ({
      blob: new Blob(['x']),
      url: 'blob:x',
      ext: 'png' as const,
      kind: 'image' as const,
    })),
    uploadImage: vi.fn(async (_blob, name) => `https://cdn/${name}`),
    ...overrides,
  };
}

describe('runVersionExport', () => {
  it('produces a row per version with localized text and cdn link', async () => {
    const deps = makeDeps();
    const rows = await runVersionExport(
      [
        { id: '111', code: 'en' },
        { id: '128', code: 'es' },
      ],
      deps,
      baseOpts,
    );
    expect(rows).toHaveLength(2);
    const niv = rows.find((r) => r.version_id === '111')!;
    expect(niv).toEqual({
      version_id: '111',
      reference: 'ref-111',
      verse_text: 'text-111',
      air_cdn_link: 'https://cdn/111.png',
    });
  });

  it('retries once then records a blank link on repeated failure', async () => {
    const uploadImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom again'));
    const rows = await runVersionExport(
      [{ id: '999', code: 'xx' }],
      makeDeps({ uploadImage }),
      baseOpts,
    );
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(rows[0].air_cdn_link).toBe('');
  });

  it('skips versions the checkpoint reports done', async () => {
    const deps = makeDeps();
    const rows = await runVersionExport(
      [
        { id: '1', code: 'en' },
        { id: '2', code: 'en' },
      ],
      deps,
      { ...baseOpts, isDone: (id) => id === '1' },
    );
    expect(rows.map((r) => r.version_id)).toEqual(['2']);
    expect(deps.fetchPassage).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/versionExport.test.ts`
Expected: FAIL — cannot resolve `./versionExport`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/export/versionExport.ts`:

```ts
import type { AspectRatio } from '../config';
import type { Passage, PassageQuery } from '../bible';
import type { LogoStyle } from '../iconCatalog';
import type { RenderInput, RenderedAsset } from '../render';
import { resolveBulkLogo } from './logo';
import type { VersionExportRow } from './types';

export interface ExportVersion {
  id: string;
  code: string;
}

export interface VersionExportDeps {
  fetchPassage: (q: PassageQuery) => Promise<Passage>;
  renderImage: (input: RenderInput) => Promise<RenderedAsset>;
  uploadImage: (blob: Blob, fileName: string) => Promise<string>;
}

export interface VersionExportOptions {
  reference: { bookId: string; chapter: number; fromVerse: number; toVerse: number };
  aspect: AspectRatio;
  dimensions: { width: number; height: number };
  logoStyle: LogoStyle;
  gradientId?: string | null;
  gradientHex?: string | null;
  imageUrl?: string | null;
  concurrency?: number;
  isDone?: (versionId: string) => boolean;
  onProgress?: (p: { done: number; total: number; failed: number }) => void;
  onRow?: (row: VersionExportRow) => void;
}

async function exportOne(
  version: ExportVersion,
  deps: VersionExportDeps,
  opts: VersionExportOptions,
): Promise<VersionExportRow> {
  const { reference } = opts;
  const passage = await deps.fetchPassage({
    versionId: version.id,
    bookId: reference.bookId,
    chapter: reference.chapter,
    fromVerse: reference.fromVerse,
    toVerse: reference.toVerse,
  });

  const logo = resolveBulkLogo(version.code, opts.logoStyle);
  const asset = await deps.renderImage({
    passage,
    aspect: opts.aspect,
    dimensions: opts.dimensions,
    imageFile: null,
    videoFile: null,
    imageUrl: opts.imageUrl ?? null,
    mimeType: 'image/jpeg',
    languageId: logo.languageId,
    logoStyle: logo.logoStyle,
    template: 'classic',
    gradientId: opts.gradientId ?? null,
    gradientHex: opts.gradientHex ?? null,
  });

  const cdnUrl = await deps.uploadImage(asset.blob, `${version.id}.${asset.ext}`);
  return {
    version_id: version.id,
    reference: passage.reference,
    verse_text: passage.text,
    air_cdn_link: cdnUrl,
  };
}

/** Run each version through fetch→render→upload with a concurrency pool. A
 *  version that fails is retried once, then recorded with a blank link. */
export async function runVersionExport(
  versions: ExportVersion[],
  deps: VersionExportDeps,
  opts: VersionExportOptions,
): Promise<VersionExportRow[]> {
  const pending = versions.filter((v) => !opts.isDone?.(v.id));
  const total = pending.length;
  const rows: VersionExportRow[] = [];
  let done = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < pending.length) {
      const version = pending[next++];
      let row: VersionExportRow | null = null;
      for (let attempt = 0; attempt < 2 && !row; attempt++) {
        try {
          row = await exportOne(version, deps, opts);
        } catch {
          if (attempt === 1) {
            failed++;
            row = {
              version_id: version.id,
              reference: '',
              verse_text: '',
              air_cdn_link: '',
            };
          }
        }
      }
      if (row) {
        rows.push(row);
        opts.onRow?.(row);
      }
      done++;
      opts.onProgress?.({ done, total, failed });
    }
  }

  const poolSize = Math.min(opts.concurrency ?? 10, Math.max(1, pending.length));
  await Promise.all(Array.from({ length: poolSize }, worker));
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/versionExport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/versionExport.ts src/lib/export/versionExport.test.ts
git commit -m "feat: add version export orchestrator"
```

---

### Task 8: Bulk Export UI (route + tab + component)

**Files:**
- Modify: `src/components/SpaceSwitcher.tsx` (add the `/export` entry)
- Create: `src/app/export/page.tsx`
- Create: `src/components/BulkExport.tsx`

**Interfaces:**
- Consumes: `SpaceShell` (`src/components/SpaceShell.tsx`); `loadBibleManifest` from `src/lib/bible/internalProvider.ts`; `YouVersionInternalProvider` from `src/lib/bible`; `ASPECT_DIMENSIONS`, `AspectRatio` from `src/config`; `renderImage` from `src/lib/render`; `uploadImageToAir` (Task 6); `runVersionExport`, `ExportVersion` (Task 7); `planGeoQueries`, `buildGeoResults`, `RawGeoPhoto` (Task 3); `buildVersionsCsv`, `buildGeoByCountryCsv`, `buildGeoByLanguageCsv` (Task 1); `LANGUAGE_COUNTRY` (Task 3).
- Produces: the `/export` page.

- [ ] **Step 1: Add the nav entry**

In `src/components/SpaceSwitcher.tsx`, add `/export` to `SPACES` (keep `/product` for now; PR #7 removes it — see Global Constraints):

```ts
const SPACES = [
  { href: '/', label: 'Digital Ads' },
  { href: '/product', label: 'Product Marketing' },
  { href: '/social', label: 'Social' },
  { href: '/export', label: 'Bulk Export' },
] as const;
```

- [ ] **Step 2: Create the route**

Create `src/app/export/page.tsx`:

```tsx
import { withAuth } from '@workos-inc/authkit-nextjs';
import { BulkExport } from '../../components/BulkExport';

export default async function ExportPage() {
  const { user } = await withAuth();
  return <BulkExport userEmail={user?.email ?? null} />;
}
```

- [ ] **Step 3: Create the component**

Create `src/components/BulkExport.tsx`. This wires the pure helpers to the browser: build the version list from the manifest, run the batch, run the geo step, and download the CSVs. Verse text uses the internal provider directly (bare version ids).

```tsx
'use client';

import { useMemo, useState } from 'react';
import { SpaceShell } from './SpaceShell';
import { Button, FieldLabel, Select } from './ui';
import { ASPECT_DIMENSIONS, type AspectRatio } from '../config';
import type { LogoStyle } from '../lib/iconCatalog';
import { renderImage } from '../lib/render';
import { YouVersionInternalProvider, loadBibleManifest } from '../lib/bible/internalProvider';
import { uploadImageToAir } from '../lib/export/airClient';
import { runVersionExport, type ExportVersion } from '../lib/export/versionExport';
import type { VersionExportRow } from '../lib/export/types';
import { buildVersionsCsv, buildGeoByCountryCsv, buildGeoByLanguageCsv } from '../lib/export/csv';
import { LANGUAGE_COUNTRY } from '../lib/export/languageCountry';
import { planGeoQueries, buildGeoResults, type RawGeoPhoto } from '../lib/export/geoBackgrounds';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchCountryPhotos(country: string, capital: string): Promise<RawGeoPhoto[]> {
  const out: RawGeoPhoto[] = [];
  for (const query of planGeoQueries({ country, capital })) {
    const res = await fetch(`/api/unsplash/search?query=${encodeURIComponent(query)}&perPage=10&orientation=landscape`);
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: { photos?: RawGeoPhoto[] } };
    for (const p of json.data?.photos ?? []) out.push(p);
  }
  return out;
}

export function BulkExport({ userEmail }: { userEmail?: string | null }) {
  const provider = useMemo(() => new YouVersionInternalProvider(), []);
  const [logoStyle, setLogoStyle] = useState<LogoStyle>('logo-light');
  const [aspect, setAspect] = useState<AspectRatio>('1:1');
  const [reference] = useState({ bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 });
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [rows, setRows] = useState<VersionExportRow[] | null>(null);
  const [geoReady, setGeoReady] = useState<{ byCountry: string; byLanguage: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runVersions() {
    setRunning(true);
    setError(null);
    setRows(null);
    try {
      const manifest = await loadBibleManifest();
      const versions: ExportVersion[] = [];
      for (const lang of manifest.languages) {
        for (const v of manifest.versionsByTag[lang.tag] ?? []) {
          versions.push({ id: v.id, code: lang.code });
        }
      }
      const result = await runVersionExport(
        versions,
        {
          fetchPassage: (q) => provider.fetchPassage(q),
          renderImage,
          uploadImage: uploadImageToAir,
        },
        {
          reference,
          aspect,
          dimensions: ASPECT_DIMENSIONS[aspect],
          logoStyle,
          gradientId: 'ocean',
          concurrency: 8,
          onProgress: setProgress,
        },
      );
      setRows(result);
      download('versions.csv', buildVersionsCsv(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setRunning(false);
    }
  }

  async function runGeo() {
    setRunning(true);
    setError(null);
    try {
      const manifest = await loadBibleManifest();
      const languages = manifest.languages
        .filter((l) => LANGUAGE_COUNTRY[l.code])
        .map((l) => ({ code: l.code, name: l.name }));
      const countries = new Map<string, string>();
      for (const l of languages) {
        const info = LANGUAGE_COUNTRY[l.code];
        countries.set(info.country, info.capital);
      }
      const photosByCountry = new Map<string, RawGeoPhoto[]>();
      for (const [country, capital] of countries) {
        photosByCountry.set(country, await fetchCountryPhotos(country, capital));
      }
      const results = buildGeoResults(languages, photosByCountry, { maxImages: 3 });
      const byCountry = buildGeoByCountryCsv(results);
      const byLanguage = buildGeoByLanguageCsv(results);
      setGeoReady({ byCountry, byLanguage });
      download('geo-backgrounds-by-country.csv', byCountry);
      download('geo-backgrounds-by-language.csv', byLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geo export failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <SpaceShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-extrabold text-ink">Bulk Export</h1>
        <p className="mt-2 text-[14px] text-muted">
          Render a branded asset for every Bible version of the selected verse, upload each to AIR,
          and download the CSVs. Geo backgrounds are a separate download.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Logo style</FieldLabel>
            <Select
              value={logoStyle}
              onChange={(e) => setLogoStyle(e.target.value as LogoStyle)}
              options={[
                { value: 'icon-only', label: 'App icon' },
                { value: 'logo-light', label: 'Lockup (light)' },
                { value: 'logo-dark', label: 'Lockup (dark)' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Aspect</FieldLabel>
            <Select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as AspectRatio)}
              options={[
                { value: '1:1', label: 'Square 1:1' },
                { value: '9:16', label: 'Portrait 9:16' },
                { value: '16:9', label: 'Landscape 16:9' },
                { value: '4:5', label: 'Portrait 4:5' },
              ]}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={runVersions} disabled={running}>
            {running ? 'Working…' : 'Export all versions'}
          </Button>
          <Button variant="secondary" onClick={runGeo} disabled={running}>
            Export geo backgrounds
          </Button>
        </div>

        {progress && (
          <p className="mt-4 text-[13px] text-muted">
            {progress.done}/{progress.total} rendered · {progress.failed} failed
          </p>
        )}
        {rows && (
          <div className="mt-2 flex items-center gap-3 text-[13px]">
            <span className="text-ink">{rows.length} versions exported.</span>
            <button className="underline" onClick={() => download('versions.csv', buildVersionsCsv(rows))}>
              Re-download versions.csv
            </button>
          </div>
        )}
        {geoReady && (
          <div className="mt-2 flex flex-col gap-1 text-[13px]">
            <button className="underline" onClick={() => download('geo-backgrounds-by-country.csv', geoReady.byCountry)}>
              Re-download geo-backgrounds-by-country.csv
            </button>
            <button className="underline" onClick={() => download('geo-backgrounds-by-language.csv', geoReady.byLanguage)}>
              Re-download geo-backgrounds-by-language.csv
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-[13px] text-brand">{error}</p>}
      </div>
    </SpaceShell>
  );
}
```

Note: if `Select`/`Button`/`FieldLabel` prop shapes differ from the above (e.g. `Button` has no `variant`), adjust to the real signatures in `src/components/ui` — check them first with a quick read.

- [ ] **Step 4: Verify UI props against the real `ui` module**

Run: `npm run typecheck`
Expected: If it fails on `Button`/`Select`/`FieldLabel` props, read `src/components/ui/index.ts` (or the ui barrel) and adjust the component to match. Re-run until clean.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: typecheck + lint clean; all tests pass.

- [ ] **Step 6: Manual verification (browser)**

Run `npm run dev`, sign in, open `/export`.
1. The **Bulk Export** tab appears in the space switcher and routes to the page.
2. Choose App icon + Square, click **Export all versions**: progress advances; when done, `versions.csv` downloads. Open it — columns `version_id,reference,verse_text,air_cdn_link`; non-English rows show localized reference/text; AIR links resolve (or blank on failures, with a failed count).
   - If AIR env is unset, the run surfaces "AIR is not configured" — set `AIR_API_KEY`/`AIR_WORKSPACE_ID` in `.env.local` and retry.
3. Click **Export geo backgrounds**: two CSVs download. Spot-check that images are landmarks (no religious/political results) and that by-language rows fan out per language.

(Per project preference, the check gate + unit tests are the primary proof; this manual pass is a spot-check when AIR/Unsplash creds are available.)

- [ ] **Step 7: Commit**

```bash
git add src/components/SpaceSwitcher.tsx src/app/export/page.tsx src/components/BulkExport.tsx
git commit -m "feat: add Bulk Export tab wiring the export pipeline"
```

---

## Self-Review

**Spec coverage:**
- Bulk Export tab / `/export` route → Task 8. ✓
- Every-version scope from manifest → Task 8 (version list build) + Task 7 (orchestrator). ✓
- Localized reference/text via internal API → Task 8 (`provider.fetchPassage`) + Task 7. ✓
- Logo: 66 localized, else English icon-only → Task 4 (`resolveBulkLogo`) + Task 7. ✓
- AIR upload (ported from client.py) → Task 5; route + client → Task 6. ✓
- versions.csv columns → Task 1 (`buildVersionsCsv`). ✓
- geo-backgrounds by-country + by-language → Task 1 builders + Task 3 results. ✓
- Geo derived from languages; deduped by country → Task 3 (`buildGeoResults`) + Task 8 (fetch loop). ✓
- Unsplash safety (non-religious/non-political, landmarks) → Task 2 (`isSafeGeoPhoto`) + Task 3 queries. ✓
- Shared background for versions; geo images only in geo CSVs → Task 7 (single gradient) + Task 8. ✓
- Retry-once-then-blank; checkpoint hook (`isDone`) → Task 7. ✓
- Server-only AIR creds → Tasks 5–6. ✓
- Images-per-country cap (default 3) + logged omissions → Task 3 (`maxImages`); Task 8 filters unmapped languages before the geo run (implicit "omit + count"). ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full code; the only conditional is Task 8 Step 4, which gives an exact procedure (read `ui`, adjust props) rather than a placeholder. ✓

**Type consistency:** `VersionExportRow`, `GeoResult`, `GeoImage` defined in Task 1 and used verbatim in Tasks 3/7/8. `resolveBulkLogo` signature (Task 4) matches its use in Task 7. `AirEnv`/`uploadToAir` (Task 5) match the route (Task 6). `runVersionExport`/`ExportVersion`/`VersionExportDeps` (Task 7) match Task 8. `RawGeoPhoto`/`planGeoQueries`/`buildGeoResults` (Task 3) match Task 8. ✓

**Note on checkpoint:** the plan wires `isDone`/`onRow` (Task 7) so resumability is available, but Task 8 does not yet persist to `localStorage` — a small follow-up if interrupted-run resume is needed in practice. Called out to avoid implying it's wired.
