// Ready-made "looks" for the Templates-first direction. A template is a preset
// of the *presentation* fields (format, aspect, gradient, layout, CTA) — it does
// not touch the user's content (language / verse / version).

import type { AspectRatio, OutputFormat } from '../config';

export type TemplateBadge = 'Story' | 'Post' | 'Email' | 'Ad';

export interface TemplatePreset {
  id: string;
  name: string;
  badge: TemplateBadge;
  format: OutputFormat;
  aspect: AspectRatio;
  /** A gradient id from `GRADIENTS` (see gradients.ts). */
  gradientId: string;
  template: 'classic' | 'promo';
  /** Sample verse text shown on the gallery card (display only). */
  sampleVerse: string;
  sampleRef: string;
  cta?: string;
}

export const TEMPLATES: TemplatePreset[] = [
  {
    id: 'dawn-ridge',
    name: 'Dawn Ridge',
    badge: 'Story',
    format: 'video',
    aspect: '9:16',
    gradientId: 'sunset',
    template: 'classic',
    sampleVerse: '“…plans to give you hope and a future.”',
    sampleRef: 'Jeremiah 29:11',
  },
  {
    id: 'bold-promise',
    name: 'Bold Promise',
    badge: 'Post',
    format: 'image',
    aspect: '1:1',
    gradientId: 'brand-red',
    template: 'promo',
    sampleVerse: 'Be strong and courageous.',
    sampleRef: 'Joshua 1:9',
    cta: 'Read it in the Bible App',
  },
  {
    id: 'quiet-cream',
    name: 'Quiet Cream',
    badge: 'Email',
    format: 'image',
    aspect: '16:9',
    gradientId: 'honey',
    template: 'classic',
    sampleVerse: 'Be still, and know that I am God.',
    sampleRef: 'Psalm 46:10',
  },
  {
    id: 'still-waters',
    name: 'Still Waters',
    badge: 'Story',
    format: 'video',
    aspect: '9:16',
    gradientId: 'azure',
    template: 'classic',
    sampleVerse: 'He leads me beside quiet waters.',
    sampleRef: 'Psalm 23:2',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    badge: 'Ad',
    format: 'video',
    aspect: '4:5',
    gradientId: 'amber',
    template: 'promo',
    sampleVerse: 'They will run and not grow weary.',
    sampleRef: 'Isaiah 40:31',
    cta: 'Download the Bible App!',
  },
  {
    id: 'midnight-psalm',
    name: 'Midnight Psalm',
    badge: 'Story',
    format: 'video',
    aspect: '9:16',
    gradientId: 'midnight',
    template: 'classic',
    sampleVerse: 'The Lord is my light and my salvation.',
    sampleRef: 'Psalm 27:1',
  },
  {
    id: 'evergreen',
    name: 'Evergreen',
    badge: 'Post',
    format: 'image',
    aspect: '1:1',
    gradientId: 'emerald',
    template: 'classic',
    sampleVerse: 'They are like a tree planted by streams of water.',
    sampleRef: 'Psalm 1:3',
  },
];

export const TEMPLATE_BY_ID: Record<string, TemplatePreset> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

/** The subset of studio setters a template drives. `useStudio()`'s return value
 * satisfies this structurally. */
export interface TemplateTarget {
  setFormat: (f: OutputFormat) => void;
  setAspect: (a: AspectRatio) => void;
  setGradientId: (id: string) => void;
  setTemplate: (t: 'classic' | 'promo') => void;
  setCta: (v: string) => void;
}

/** Apply a template's presentation preset to the studio. Content (verse,
 * language, version) is intentionally left untouched. */
export function applyTemplate(target: TemplateTarget, tpl: TemplatePreset): void {
  target.setFormat(tpl.format);
  target.setAspect(tpl.aspect);
  target.setGradientId(tpl.gradientId);
  target.setTemplate(tpl.template);
  if (tpl.cta != null) target.setCta(tpl.cta);
}
