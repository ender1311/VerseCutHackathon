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
