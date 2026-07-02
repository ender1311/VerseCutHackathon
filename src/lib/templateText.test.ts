import { describe, expect, it } from 'vitest';
import { wrapLines } from './templateText';

const measure = (s: string) => s.length; // 1 unit per char

describe('wrapLines', () => {
  it('wraps on word boundaries within maxWidth', () => {
    expect(wrapLines(measure, 'get things done easily', 11)).toEqual(['get things', 'done easily']);
  });
  it('keeps a single over-long word on its own line', () => {
    expect(wrapLines(measure, 'supercalifragilistic word', 10)).toEqual([
      'supercalifragilistic',
      'word',
    ]);
  });
  it('returns [] for empty text', () => {
    expect(wrapLines(measure, '   ', 10)).toEqual([]);
  });
});
