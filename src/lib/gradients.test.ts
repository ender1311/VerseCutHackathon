import { describe, expect, it } from 'vitest';
import {
  GRADIENTS,
  DEFAULT_GRADIENT_ID,
  CUSTOM_GRADIENT_ID,
  resolveGradient,
  normalizeHex,
  gradientFromHex,
} from './gradients';

describe('gradients', () => {
  it('exposes 32 presets with unique ids', () => {
    expect(GRADIENTS).toHaveLength(32);
    expect(new Set(GRADIENTS.map((g) => g.id)).size).toBe(32);
  });

  it('resolves a known id', () => {
    expect(resolveGradient('emerald').id).toBe('emerald');
  });

  it('falls back to the default for unknown / empty ids', () => {
    expect(resolveGradient('nope').id).toBe(DEFAULT_GRADIENT_ID);
    expect(resolveGradient(null).id).toBe(DEFAULT_GRADIENT_ID);
    expect(resolveGradient(undefined).id).toBe(DEFAULT_GRADIENT_ID);
  });

  it('every preset defines linear stops and an rgba glow', () => {
    for (const g of GRADIENTS) {
      expect(g.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(g.via).toMatch(/^#[0-9a-f]{6}$/i);
      expect(g.to).toMatch(/^#[0-9a-f]{6}$/i);
      expect(g.glow).toMatch(/^rgba\(/);
    }
  });
});

describe('normalizeHex', () => {
  it('normalizes 6-digit hex with/without hash and case', () => {
    expect(normalizeHex('#1E40AF')).toBe('#1e40af');
    expect(normalizeHex('1e40af')).toBe('#1e40af');
    expect(normalizeHex('  #ABCDEF ')).toBe('#abcdef');
  });
  it('expands 3-digit shorthand', () => {
    expect(normalizeHex('#0af')).toBe('#00aaff');
    expect(normalizeHex('f00')).toBe('#ff0000');
  });
  it('rejects invalid input', () => {
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('nothex')).toBeNull();
    expect(normalizeHex('#12345g')).toBeNull();
  });
});

describe('gradientFromHex', () => {
  it('derives a custom preset with valid stops and glow', () => {
    const g = gradientFromHex('#1e40af');
    expect(g.id).toBe(CUSTOM_GRADIENT_ID);
    expect(g.from).toMatch(/^#[0-9a-f]{6}$/);
    expect(g.via).toMatch(/^#[0-9a-f]{6}$/);
    expect(g.to).toMatch(/^#[0-9a-f]{6}$/);
    expect(g.glow).toMatch(/^rgba\(\d+,\d+,\d+,0\.34\)$/);
  });
  it('makes the fill darker than the source (legible under white text)', () => {
    const g = gradientFromHex('#ffffff');
    // via scaled to 0.6 of pure white → #999999
    expect(g.via).toBe('#999999');
    expect(g.to).toBe('#242424');
  });
  it('falls back to the default preset for invalid hex', () => {
    expect(gradientFromHex('bogus').id).toBe(DEFAULT_GRADIENT_ID);
  });
});
