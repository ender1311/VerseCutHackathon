import { describe, it, expect } from 'vitest';
import { isLandmarkPhotoSafe } from './landmarkSafety';

describe('isLandmarkPhotoSafe', () => {
  it('always allows the selected landmark, even if religious', () => {
    expect(isLandmarkPhotoSafe('The Taj Mahal at sunrise', 'Taj Mahal')).toBe(true);
  });

  it('allows photos with no description', () => {
    expect(isLandmarkPhotoSafe(null, 'Eiffel Tower')).toBe(true);
  });

  it('allows Christian references', () => {
    expect(isLandmarkPhotoSafe('A stone church and cross', 'Eiffel Tower')).toBe(true);
    expect(isLandmarkPhotoSafe('Cathedral interior', 'Big Ben London')).toBe(true);
  });

  it('blocks non-Christian worship imagery', () => {
    expect(isLandmarkPhotoSafe('Inside a mosque', 'Eiffel Tower')).toBe(false);
    expect(isLandmarkPhotoSafe('A hindu temple at dusk', 'Eiffel Tower')).toBe(false);
  });

  it('blocks political and military imagery', () => {
    expect(isLandmarkPhotoSafe('A street protest', 'Eiffel Tower')).toBe(false);
    expect(isLandmarkPhotoSafe('soldiers marching', 'Eiffel Tower')).toBe(false);
  });

  it('matches blocked terms only as whole words', () => {
    // "Warsaw" contains "war" but must not be blocked.
    expect(isLandmarkPhotoSafe('Warsaw old town square', 'Eiffel Tower')).toBe(true);
  });
});
