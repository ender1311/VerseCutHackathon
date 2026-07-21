import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECTIONS,
  resolveSections,
  toggleSection,
  parseStoredSections,
} from './panelLayout';

describe('resolveSections', () => {
  it('returns defaults for null', () => {
    expect(resolveSections(null)).toEqual(DEFAULT_SECTIONS);
  });
  it('merges partial state over defaults', () => {
    expect(resolveSections({ audio: true })).toEqual({
      ...DEFAULT_SECTIONS,
      audio: true,
    });
  });
});

describe('toggleSection', () => {
  it('flips a single key without mutating the input', () => {
    const start = { ...DEFAULT_SECTIONS };
    const next = toggleSection(start, 'audio');
    expect(next.audio).toBe(!DEFAULT_SECTIONS.audio);
    expect(next.content).toBe(DEFAULT_SECTIONS.content);
    expect(start.audio).toBe(DEFAULT_SECTIONS.audio);
  });
});

describe('parseStoredSections', () => {
  it('returns defaults for null', () => {
    expect(parseStoredSections(null)).toEqual(DEFAULT_SECTIONS);
  });
  it('returns defaults for invalid JSON', () => {
    expect(parseStoredSections('{not json')).toEqual(DEFAULT_SECTIONS);
  });
  it('merges valid partial JSON over defaults', () => {
    expect(parseStoredSections('{"branding":true}')).toEqual({
      ...DEFAULT_SECTIONS,
      branding: true,
    });
  });
});
