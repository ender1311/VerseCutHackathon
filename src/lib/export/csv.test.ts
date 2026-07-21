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
