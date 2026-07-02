import { describe, expect, it } from 'vitest';
import { PRODUCT_TEMPLATES, IPHONE_14_PRO } from './productTemplates';

describe('PRODUCT_TEMPLATES', () => {
  it('has the four iOS templates', () => {
    expect(PRODUCT_TEMPLATES.map((t) => t.id).sort()).toEqual([
      'plans',
      'prayers',
      'reader',
      'today',
    ]);
  });

  it('places the device within the canvas for every template', () => {
    for (const t of PRODUCT_TEMPLATES) {
      expect(t.platform).toBe('ios');
      expect(t.canvas.w).toBeGreaterThan(0);
      expect(t.canvas.h).toBeGreaterThan(0);
      expect(t.deviceRect.x).toBeGreaterThanOrEqual(0);
      expect(t.deviceRect.x + t.deviceRect.w).toBeLessThanOrEqual(t.canvas.w + 1);
      expect(t.deviceRect.y + t.deviceRect.h).toBeLessThanOrEqual(t.canvas.h);
    }
  });

  it('keeps the screen slot inside the device frame', () => {
    const s = IPHONE_14_PRO.screenSlot;
    expect(s.x + s.w).toBeLessThanOrEqual(IPHONE_14_PRO.size.w);
    expect(s.y + s.h).toBeLessThanOrEqual(IPHONE_14_PRO.size.h);
    expect(s.radius).toBeGreaterThan(0);
  });
});
