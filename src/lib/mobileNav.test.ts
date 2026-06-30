import { describe, expect, it } from 'vitest';
import { MOBILE_TABS, isMobileView } from './mobileNav';

describe('MOBILE_TABS', () => {
  it('is Edit, Preview, Library in order', () => {
    expect(MOBILE_TABS.map((t) => t.id)).toEqual(['edit', 'preview', 'library']);
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(['Edit', 'Preview', 'Library']);
  });
});

describe('isMobileView', () => {
  it('accepts the three valid views', () => {
    expect(isMobileView('edit')).toBe(true);
    expect(isMobileView('preview')).toBe(true);
    expect(isMobileView('library')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isMobileView('output')).toBe(false);
    expect(isMobileView(null)).toBe(false);
    expect(isMobileView(2)).toBe(false);
  });
});
