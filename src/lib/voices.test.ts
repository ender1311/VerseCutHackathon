import { describe, expect, it } from 'vitest';
import { defaultVoice, voiceSupported, VOICES } from './voices';

describe('voices', () => {
  it('maps base language codes to a default voice', () => {
    expect(defaultVoice('en')).toBe('af_heart');
    expect(defaultVoice('es')).toBe('ef_dora');
    expect(defaultVoice('pt')).toBe('pf_dora');
  });

  it('falls back to the base code for region/script variants', () => {
    expect(defaultVoice('en-GB')).toBe('bf_emma');
    expect(defaultVoice('pt_BR')).toBe('pf_dora');
    expect(defaultVoice('zh_TW')).toBe('zf_xiaobei');
  });

  it('returns null for languages Kokoro does not cover', () => {
    expect(defaultVoice('af')).toBeNull();
    expect(voiceSupported('af')).toBe(false);
    expect(voiceSupported('en')).toBe(true);
  });

  it('every voice has a default for its language', () => {
    for (const v of VOICES) {
      expect(voiceSupported(v.lang)).toBe(true);
    }
  });
});
