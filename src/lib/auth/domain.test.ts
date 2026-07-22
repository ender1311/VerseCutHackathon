import { describe, expect, it } from 'vitest';
import { isAllowedEmailDomain } from '@/lib/auth/domain';

describe('isAllowedEmailDomain', () => {
  it('allows configured org domains', () => {
    expect(isAllowedEmailDomain('dan.luk@youversion.com')).toBe(true);
    expect(isAllowedEmailDomain('someone@uversion.com')).toBe(true);
    expect(isAllowedEmailDomain('pastor@life.church')).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isAllowedEmailDomain('  Dan.Luk@YouVersion.COM  ')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isAllowedEmailDomain('user@gmail.com')).toBe(false);
    expect(isAllowedEmailDomain('user@example.com')).toBe(false);
  });

  it('rejects lookalike domains not anchored on @', () => {
    expect(isAllowedEmailDomain('user@evil-youversion.com')).toBe(false);
    expect(isAllowedEmailDomain('user@sub.youversion.com')).toBe(false);
    expect(isAllowedEmailDomain('youversion.com@gmail.com')).toBe(false);
  });

  it('rejects empty / missing input', () => {
    expect(isAllowedEmailDomain(undefined)).toBe(false);
    expect(isAllowedEmailDomain(null)).toBe(false);
    expect(isAllowedEmailDomain('')).toBe(false);
  });
});
