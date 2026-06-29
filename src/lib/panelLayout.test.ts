import { describe, expect, it } from 'vitest';
import {
  clampPanelWidth,
  parseStoredWidth,
  MIN_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_SECTIONS,
  resolveSections,
  toggleSection,
  parseStoredSections,
} from './panelLayout';

describe('clampPanelWidth', () => {
  it('returns values within bounds unchanged (rounded)', () => {
    expect(clampPanelWidth(500)).toBe(500);
    expect(clampPanelWidth(460.6)).toBe(461);
  });
  it('clamps below the minimum', () => {
    expect(clampPanelWidth(100)).toBe(MIN_PANEL_WIDTH);
  });
  it('clamps above the maximum', () => {
    expect(clampPanelWidth(9999)).toBe(MAX_PANEL_WIDTH);
  });
  it('falls back to default for non-finite input', () => {
    expect(clampPanelWidth(Number.NaN)).toBe(DEFAULT_PANEL_WIDTH);
    expect(clampPanelWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PANEL_WIDTH);
  });
});

describe('parseStoredWidth', () => {
  it('returns null for missing values', () => {
    expect(parseStoredWidth(null)).toBeNull();
  });
  it('returns null for non-numeric values', () => {
    expect(parseStoredWidth('wide')).toBeNull();
  });
  it('parses and clamps numeric strings', () => {
    expect(parseStoredWidth('500')).toBe(500);
    expect(parseStoredWidth('100')).toBe(MIN_PANEL_WIDTH);
    expect(parseStoredWidth('9999')).toBe(MAX_PANEL_WIDTH);
  });
});

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
