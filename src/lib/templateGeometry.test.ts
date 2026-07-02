import { describe, expect, it } from 'vitest';
import { coverRect } from './templateGeometry';

const slot = { x: 100, y: 200, w: 400, h: 800 }; // ratio 0.5

describe('coverRect', () => {
  it('crops the sides of a too-wide image', () => {
    const r = coverRect(slot, 800, 800);
    expect({ dx: r.dx, dy: r.dy, dw: r.dw, dh: r.dh }).toEqual({ dx: 100, dy: 200, dw: 400, dh: 800 });
    expect(r.sh).toBe(800);
    expect(r.sw).toBeCloseTo(400);
    expect(r.sx).toBeCloseTo(200);
    expect(r.sy).toBe(0);
  });
  it('crops top/bottom of a too-tall image', () => {
    const r = coverRect(slot, 400, 1600);
    expect(r.sw).toBe(400);
    expect(r.sh).toBeCloseTo(800);
    expect(r.sx).toBe(0);
    expect(r.sy).toBeCloseTo(400);
  });
  it('no crop when ratios match', () => {
    const r = coverRect(slot, 400, 800);
    expect({ sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh }).toEqual({ sx: 0, sy: 0, sw: 400, sh: 800 });
  });
  it('guards degenerate image sizes', () => {
    expect(coverRect(slot, 0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0, dx: 100, dy: 200, dw: 400, dh: 800 });
  });
});
