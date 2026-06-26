import { describe, expect, it } from 'vitest';
import { detectScript } from './fonts';

describe('detectScript', () => {
  it('defaults to latin', () => {
    expect(detectScript('For God so loved the world')).toBe('latin');
  });
  it('detects arabic', () => {
    expect(detectScript('لأنه هكذا أحب الله العالم')).toBe('arabic');
  });
  it('detects hebrew', () => {
    expect(detectScript('כִּי כֹה אָהַב אֱלֹהִים')).toBe('hebrew');
  });
  it('detects cyrillic', () => {
    expect(detectScript('Ибо так возлюбил Бог мир')).toBe('cyrillic');
  });
  it('detects devanagari', () => {
    expect(detectScript('क्योंकि परमेश्वर ने जगत से')).toBe('devanagari');
  });
  it('detects thai', () => {
    expect(detectScript('เพราะว่าพระเจ้าทรงรักโลก')).toBe('thai');
  });
  it('detects korean (hangul)', () => {
    expect(detectScript('하나님이 세상을 이처럼 사랑하사')).toBe('korean');
  });
  it('detects japanese when kana present (over han)', () => {
    expect(detectScript('神はそのひとり子を賜わったほどに')).toBe('japanese');
  });
  it('detects chinese han (no kana)', () => {
    expect(detectScript('神爱世人甚至将他的独生子赐给他们')).toBe('han');
  });
  it('picks the dominant non-latin script in mixed text', () => {
    // a stray latin name inside arabic text should still be arabic
    expect(detectScript('قال يسوع Jesus لهم')).toBe('arabic');
  });
});
