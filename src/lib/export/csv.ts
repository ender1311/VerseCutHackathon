import type { GeoResult, VersionExportRow } from './types';

const IMG_JOIN = ' | ';

/**
 * Escape a CSV field. RFC-4180 quoting for comma/quote/CR/LF, plus
 * spreadsheet-formula-injection neutralization: values starting with = + - @
 * (or a leading tab/CR) get a leading apostrophe so Excel/Sheets treat them as
 * text, not formulas. Untrusted text (Unsplash credits, verse text) flows here.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
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
    ['country', 'capital', 'image_urls', 'cdn_urls', 'unsplash_credits'],
    results.map((g) => [
      g.country,
      g.capital,
      g.images.map((i) => i.url).join(IMG_JOIN),
      g.images.map((i) => i.cdnUrl ?? '').join(IMG_JOIN),
      g.images.map((i) => i.credit).join(IMG_JOIN),
    ]),
  );
}

export function buildGeoByLanguageCsv(results: GeoResult[]): string {
  const rows: string[][] = [];
  for (const g of results) {
    const urls = g.images.map((i) => i.url).join(IMG_JOIN);
    const cdnUrls = g.images.map((i) => i.cdnUrl ?? '').join(IMG_JOIN);
    const credits = g.images.map((i) => i.credit).join(IMG_JOIN);
    for (const lang of g.languages) {
      rows.push([lang.code, lang.name, g.country, urls, cdnUrls, credits]);
    }
  }
  return toCsv(
    ['language', 'language_name', 'country', 'image_urls', 'cdn_urls', 'unsplash_credits'],
    rows,
  );
}
