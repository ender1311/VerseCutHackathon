import { describe, expect, it } from 'vitest';

// MediaRecorder is not available in vitest/jsdom, so we test the guard logic
// directly: calling stop() on an 'inactive' recorder per the Web API spec throws
// InvalidStateError. The fix in captureCanvas() guards with `rec.state !== 'inactive'`.

describe('MediaRecorder inactive-state guard (regression)', () => {
  it('does not call stop() when recorder is already inactive', () => {
    // Simulate the recorder object after onerror fires (state → 'inactive').
    let stopCalled = false;
    const rec = {
      state: 'inactive' as RecordingState,
      stop() {
        stopCalled = true;
        throw new DOMException('recorder already stopped', 'InvalidStateError');
      },
    };

    // Apply the guard exactly as written in captureCanvas().
    if (rec.state !== 'inactive') rec.stop();

    expect(stopCalled).toBe(false);
  });

  it('calls stop() when recorder is recording', () => {
    let stopCalled = false;
    const rec = {
      state: 'recording' as RecordingState,
      stop() {
        stopCalled = true;
      },
    };

    if (rec.state !== 'inactive') rec.stop();

    expect(stopCalled).toBe(true);
  });

  it('calls stop() when recorder is paused', () => {
    let stopCalled = false;
    const rec = {
      state: 'paused' as RecordingState,
      stop() {
        stopCalled = true;
      },
    };

    if (rec.state !== 'inactive') rec.stop();

    expect(stopCalled).toBe(true);
  });
});
