import { describe, expect, it } from 'vitest';
import { resolveBulkLogo } from './logo';

describe('resolveBulkLogo', () => {
  it('keeps the chosen style for a covered language', () => {
    expect(resolveBulkLogo('es', 'logo-light')).toEqual({ languageId: 'es', logoStyle: 'logo-light' });
    expect(resolveBulkLogo('fr', 'icon-only')).toEqual({ languageId: 'fr', logoStyle: 'icon-only' });
  });
  it('falls back to English icon-only for an uncovered language', () => {
    expect(resolveBulkLogo('aau', 'logo-light')).toEqual({ languageId: 'en', logoStyle: 'icon-only' });
    expect(resolveBulkLogo('acr', 'logo-dark')).toEqual({ languageId: 'en', logoStyle: 'icon-only' });
  });
});
