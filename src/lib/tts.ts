// In-browser text-to-speech via Kokoro (kokoro-js + transformers.js), running
// client-side on WebGPU (fallback WASM) — no API key, no server. The ~80 MB
// quantized model downloads once and is cached by the browser. Used to mix a
// verse voiceover into the generated video.
//
// Kept behind a dynamic import so the heavy runtime stays out of the main bundle
// and never executes during SSR.

export type TtsStatus = 'idle' | 'loading' | 'ready' | 'error';

let modelPromise: Promise<unknown> | null = null;
let status: TtsStatus = 'idle';
let downloadPct = 0;

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export function ttsState(): { status: TtsStatus; pct: number } {
  return { status, pct: downloadPct };
}

/** Whether the runtime supports WebGPU (fast path); otherwise WASM is used. */
export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export type TtsDevice = 'webgpu' | 'wasm';
export type TtsDtype = 'fp32' | 'q8';

/**
 * Kokoro's quantized `q8` weights produce garbled/gibberish audio on the
 * transformers.js WebGPU backend — kokoro-js recommends `fp32` for WebGPU.
 * On WASM, `q8` is the documented default: correct and ~4x smaller. So pick the
 * dtype by device rather than always using q8.
 */
export function dtypeForDevice(device: TtsDevice): TtsDtype {
  return device === 'webgpu' ? 'fp32' : 'q8';
}

async function getModel(onProgress?: (pct: number) => void): Promise<unknown> {
  if (modelPromise) return modelPromise;
  status = 'loading';
  modelPromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    const device: TtsDevice = hasWebGPU() ? 'webgpu' : 'wasm';
    const model = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: dtypeForDevice(device),
      device,
      progress_callback: (p: { status?: string; loaded?: number; total?: number }) => {
        if (p?.status === 'progress' && p.total) {
          downloadPct = Math.min(100, Math.round((p.loaded! / p.total) * 100));
          onProgress?.(downloadPct);
        }
      },
    });
    status = 'ready';
    downloadPct = 100;
    return model;
  })().catch((e) => {
    status = 'error';
    modelPromise = null;
    throw e;
  });
  return modelPromise;
}

/** Kick off the model download early (e.g. when the user enables voiceover). */
export function preloadTts(onProgress?: (pct: number) => void): void {
  void getModel(onProgress).catch(() => {});
}

export interface Narration {
  blob: Blob;
  durationSec: number;
}

/** Synthesize speech for `text` with a Kokoro `voice` id (e.g. "af_heart"). */
export async function synthesize(
  text: string,
  voice: string,
  onProgress?: (pct: number) => void,
): Promise<Narration> {
  const model = (await getModel(onProgress)) as {
    generate: (
      t: string,
      o: { voice: string },
    ) => Promise<{ toBlob: () => Blob; audio: Float32Array; sampling_rate: number }>;
  };
  const audio = await model.generate(text, { voice });
  return {
    blob: audio.toBlob(),
    durationSec: audio.audio.length / audio.sampling_rate,
  };
}
