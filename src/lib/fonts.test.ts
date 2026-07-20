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
  it('detects telugu', () => {
    expect(detectScript('ఆదికాండము')).toBe('telugu');
    expect(detectScript('ఆదియందు దేవుడు భూమ్యాకాశములను సృజించెను')).toBe('telugu');
  });
  it('detects tamil', () => {
    expect(detectScript('ஆதியாகமம்')).toBe('tamil');
  });
  it('detects kannada', () => {
    expect(detectScript('ಆದಿಕಾಂಡ')).toBe('kannada');
  });
  it('detects malayalam', () => {
    expect(detectScript('ഉല്പത്തി')).toBe('malayalam');
  });
  it('detects bengali', () => {
    expect(detectScript('আদিপুস্তক')).toBe('bengali');
  });
  it('detects gujarati', () => {
    expect(detectScript('ઉત્પત્તિ')).toBe('gujarati');
  });
  it('detects gurmukhi', () => {
    expect(detectScript('ਉਤਪਤ')).toBe('gurmukhi');
  });
  it('detects oriya', () => {
    expect(detectScript('ଆଦିପୁସ୍ତକ')).toBe('oriya');
  });
  it('detects sinhala', () => {
    expect(detectScript('උත්පත්ති')).toBe('sinhala');
  });
  it('detects ethiopic (amharic)', () => {
    expect(detectScript('ኦሪት ዘፍጥረት')).toBe('ethiopic');
  });
  it('detects armenian', () => {
    expect(detectScript('Ծննդոց')).toBe('armenian');
  });
  it('detects georgian', () => {
    expect(detectScript('დაბადება')).toBe('georgian');
  });
  it('detects khmer', () => {
    expect(detectScript('លោកុប្បត្តិ')).toBe('khmer');
  });
  it('detects myanmar (burmese)', () => {
    expect(detectScript('ကမ္ဘာဦး')).toBe('myanmar');
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
  it('stays latin when a stray non-latin glyph appears in latin text', () => {
    // A single Hebrew/Greek char must not hijack the whole verse (and flip RTL).
    expect(detectScript('See the note (א) for detail')).toBe('latin');
    expect(detectScript('In the beginning was the Word Λογος')).toBe('latin');
  });
});
