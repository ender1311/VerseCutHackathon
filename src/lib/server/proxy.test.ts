import { describe, expect, it } from 'vitest';
import { isAllowedPath } from './proxy';

describe('isAllowedPath', () => {
  it('allows the permitted prefix', () => {
    expect(isAllowedPath(['v1', 'bibles', '111'], ['v1'])).toBe(true);
    expect(isAllowedPath(['3.1', 'chapter.json'], ['3.1'])).toBe(true);
  });

  it('rejects a disallowed first segment', () => {
    expect(isAllowedPath(['admin', 'users'], ['v1'])).toBe(false);
    expect(isAllowedPath(['v2', 'bibles'], ['v1'])).toBe(false);
  });

  it('rejects path traversal and empty segments', () => {
    expect(isAllowedPath(['v1', '..', '..', 'secret'], ['v1'])).toBe(false);
    expect(isAllowedPath(['v1', '.'], ['v1'])).toBe(false);
    expect(isAllowedPath(['v1', ''], ['v1'])).toBe(false);
    expect(isAllowedPath(['v1', 'a/b'], ['v1'])).toBe(false);
  });

  it('rejects an empty path', () => {
    expect(isAllowedPath([], ['v1'])).toBe(false);
  });

  it('without an allowlist still blocks traversal but allows normal segments', () => {
    expect(isAllowedPath(['anything', 'goes'])).toBe(true);
    expect(isAllowedPath(['..', 'evil'])).toBe(false);
  });
});
