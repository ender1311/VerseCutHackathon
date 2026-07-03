import { describe, expect, it } from 'vitest';
import { dtypeForDevice } from './tts';

describe('dtypeForDevice', () => {
  it('uses fp32 on WebGPU (q8 produces gibberish there)', () => {
    expect(dtypeForDevice('webgpu')).toBe('fp32');
  });
  it('uses q8 on WASM (correct and smaller)', () => {
    expect(dtypeForDevice('wasm')).toBe('q8');
  });
});
