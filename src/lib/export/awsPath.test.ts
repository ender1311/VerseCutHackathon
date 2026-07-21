import { describe, expect, it } from 'vitest';
import { s3KeyForVersion, publicS3Url } from './awsPath';

describe('s3KeyForVersion', () => {
  it('builds a sanitized deterministic key', () => {
    expect(s3KeyForVersion({ bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 }, '111')).toBe(
      'versecut/jhn3_16/111.jpg',
    );
  });
  it('encodes a verse range', () => {
    expect(s3KeyForVersion({ bookId: '1JN', chapter: 4, fromVerse: 7, toVerse: 8 }, '59')).toBe(
      'versecut/1jn4_7-8/59.jpg',
    );
  });
});

describe('publicS3Url', () => {
  it('uses the S3 path style by default', () => {
    expect(publicS3Url('web-assets.youversion.com', 'versecut/x/1.jpg')).toBe(
      'https://s3.amazonaws.com/web-assets.youversion.com/versecut/x/1.jpg',
    );
  });
  it('prefers a CDN base when provided', () => {
    expect(publicS3Url('b', 'versecut/x/1.jpg', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/versecut/x/1.jpg',
    );
  });
});
