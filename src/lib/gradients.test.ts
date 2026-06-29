import { describe, expect, it } from 'vitest';
import { GRADIENTS, DEFAULT_GRADIENT_ID, resolveGradient } from './gradients';

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
