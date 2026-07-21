import { describe, expect, it, vi } from 'vitest';
import { applyTemplate, TEMPLATES, TEMPLATE_BY_ID, type TemplateTarget } from './templates';

function makeTarget(): TemplateTarget & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const rec = (name: string) =>
    vi.fn((v: unknown) => {
      calls[name] = [...(calls[name] ?? []), v];
    });
  return {
    calls,
    setFormat: rec('setFormat'),
    setAspect: rec('setAspect'),
    setGradientId: rec('setGradientId'),
    setTemplate: rec('setTemplate'),
    setCta: rec('setCta'),
  };
}

describe('templates data', () => {
  it('has unique ids and valid badges', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) {
      expect(['Story', 'Post', 'Email', 'Ad']).toContain(t.badge);
    }
  });
  it('TEMPLATE_BY_ID indexes every template', () => {
    for (const t of TEMPLATES) expect(TEMPLATE_BY_ID[t.id]).toBe(t);
  });
});

describe('applyTemplate', () => {
  it('drives the presentation setters from the preset', () => {
    const target = makeTarget();
    const tpl = TEMPLATE_BY_ID['golden-hour'];
    applyTemplate(target, tpl);
    expect(target.calls.setFormat).toEqual([tpl.format]);
    expect(target.calls.setAspect).toEqual([tpl.aspect]);
    expect(target.calls.setGradientId).toEqual([tpl.gradientId]);
    expect(target.calls.setTemplate).toEqual([tpl.template]);
    expect(target.calls.setCta).toEqual([tpl.cta]);
  });
  it('skips setCta when the template has none', () => {
    const target = makeTarget();
    const tpl = TEMPLATE_BY_ID['dawn-ridge'];
    expect(tpl.cta).toBeUndefined();
    applyTemplate(target, tpl);
    expect(target.calls.setCta).toBeUndefined();
    expect(target.calls.setGradientId).toEqual(['sunset']);
  });
});
