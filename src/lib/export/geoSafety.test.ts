import { describe, expect, it } from 'vitest';
import { isSafeGeoPhoto } from './geoSafety';

describe('isSafeGeoPhoto', () => {
  it('accepts neutral landmarks', () => {
    expect(isSafeGeoPhoto({ description: 'Eiffel Tower at sunset' })).toBe(true);
    expect(isSafeGeoPhoto({ description: 'Tokyo skyline at night' })).toBe(true);
    expect(isSafeGeoPhoto({ description: null })).toBe(true);
  });
  it('rejects religious imagery of any faith', () => {
    expect(isSafeGeoPhoto({ description: 'Notre-Dame cathedral church' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'A mosque at dawn' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'Hindu temple' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'people at prayer' })).toBe(false);
  });
  it('rejects political and conflict imagery', () => {
    expect(isSafeGeoPhoto({ description: 'street protest against the election' })).toBe(false);
    expect(isSafeGeoPhoto({ description: 'soldiers with weapons at war' })).toBe(false);
  });
  it('matches whole words only (no substring false positives)', () => {
    expect(isSafeGeoPhoto({ description: 'Warsaw skyline' })).toBe(true); // 'war' in Warsaw
    expect(isSafeGeoPhoto({ description: 'a busy crossing in the city' })).toBe(true); // 'cross'
    expect(isSafeGeoPhoto({ description: 'Temple Bar district, Dublin' })).toBe(false); // 'temple' is still a word
    expect(isSafeGeoPhoto({ description: 'war memorial' })).toBe(false);
  });
});
