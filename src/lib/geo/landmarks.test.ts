import { describe, it, expect } from 'vitest';
import { GEO_LANDMARKS, DEFAULT_GEO_LANDMARK, getGeoLandmark } from './landmarks';

describe('geo landmarks', () => {
  it('defaults to India / Taj Mahal', () => {
    expect(DEFAULT_GEO_LANDMARK.country).toBe('India');
    expect(DEFAULT_GEO_LANDMARK.term).toBe('Taj Mahal');
    expect(GEO_LANDMARKS[0]).toBe(DEFAULT_GEO_LANDMARK);
  });

  it('looks up a landmark by code', () => {
    expect(getGeoLandmark('fr').term).toBe('Eiffel Tower');
  });

  it('falls back to the default for an unknown code', () => {
    expect(getGeoLandmark('zz')).toBe(DEFAULT_GEO_LANDMARK);
  });

  it('has unique codes', () => {
    const codes = GEO_LANDMARKS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
