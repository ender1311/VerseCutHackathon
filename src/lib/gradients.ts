// Background gradient presets for the generated-gradient background (classic
// template). Each preset is a diagonal 3-stop linear fill plus a soft radial
// accent glow toward the top — the same recipe as the original brand default,
// parameterized by color. White verse text + the dark contrast scrim keep all
// of these legible, so they lean rich/deep rather than pastel.

export interface GradientPreset {
  id: string;
  name: string;
  /** Linear stops at 0 / 0.5 / 1, drawn top-left → bottom-right. */
  from: string;
  via: string;
  to: string;
  /** Radial accent glow (rgba) centered near the top. */
  glow: string;
}

export const GRADIENTS: GradientPreset[] = [
  { id: 'brand-red', name: 'Brand Red', from: '#2a0a10', via: '#3d0d18', to: '#120406', glow: 'rgba(254,55,69,0.32)' },
  { id: 'crimson', name: 'Crimson', from: '#4a0c12', via: '#7f1d1d', to: '#1c0407', glow: 'rgba(248,113,113,0.30)' },
  { id: 'ember', name: 'Ember', from: '#3a0a0a', via: '#991b1b', to: '#170303', glow: 'rgba(252,165,165,0.28)' },
  { id: 'sunset', name: 'Sunset', from: '#3a160a', via: '#9a3412', to: '#160803', glow: 'rgba(251,146,60,0.34)' },
  { id: 'amber', name: 'Amber', from: '#3a2407', via: '#92400e', to: '#170d02', glow: 'rgba(251,191,36,0.34)' },
  { id: 'honey', name: 'Honey', from: '#3a2e07', via: '#a16207', to: '#171202', glow: 'rgba(250,204,21,0.32)' },
  { id: 'coral', name: 'Coral', from: '#3a0f14', via: '#e11d48', to: '#1a060a', glow: 'rgba(251,113,133,0.32)' },
  { id: 'rose', name: 'Rose', from: '#3a0a18', via: '#9f1239', to: '#18040a', glow: 'rgba(251,113,133,0.30)' },
  { id: 'blush', name: 'Blush', from: '#3a1020', via: '#be185d', to: '#180610', glow: 'rgba(244,114,182,0.30)' },
  { id: 'magenta', name: 'Magenta', from: '#320a24', via: '#9d174d', to: '#16040f', glow: 'rgba(244,114,182,0.30)' },
  { id: 'fuchsia', name: 'Fuchsia', from: '#2e0a2e', via: '#a21caf', to: '#140414', glow: 'rgba(232,121,249,0.30)' },
  { id: 'plum', name: 'Plum', from: '#2a0f3a', via: '#6b21a8', to: '#120518', glow: 'rgba(192,132,252,0.30)' },
  { id: 'purple', name: 'Purple', from: '#2a0a4a', via: '#7e22ce', to: '#120222', glow: 'rgba(192,132,252,0.32)' },
  { id: 'grape', name: 'Grape', from: '#1a0b3a', via: '#4c1d95', to: '#0c0520', glow: 'rgba(167,139,250,0.30)' },
  { id: 'violet', name: 'Violet', from: '#1f1147', via: '#5b21b6', to: '#0e0820', glow: 'rgba(167,139,250,0.32)' },
  { id: 'indigo', name: 'Indigo', from: '#141a4a', via: '#3730a3', to: '#0a0c24', glow: 'rgba(129,140,248,0.32)' },
  { id: 'royal', name: 'Royal Blue', from: '#0c1a4a', via: '#1e40af', to: '#060e28', glow: 'rgba(96,165,250,0.32)' },
  { id: 'cobalt', name: 'Cobalt', from: '#0a1c3a', via: '#1d4ed8', to: '#050e1c', glow: 'rgba(96,165,250,0.32)' },
  { id: 'azure', name: 'Azure', from: '#0a2240', via: '#0369a1', to: '#051422', glow: 'rgba(56,189,248,0.32)' },
  { id: 'sky', name: 'Sky', from: '#0a2a40', via: '#0284c7', to: '#05161f', glow: 'rgba(125,211,252,0.30)' },
  { id: 'ocean', name: 'Ocean', from: '#0a2a3a', via: '#155e75', to: '#04151c', glow: 'rgba(56,189,248,0.30)' },
  { id: 'cyan', name: 'Cyan', from: '#073338', via: '#0e7490', to: '#02181b', glow: 'rgba(34,211,238,0.30)' },
  { id: 'teal', name: 'Teal', from: '#06302b', via: '#0f766e', to: '#021a17', glow: 'rgba(45,212,191,0.30)' },
  { id: 'mint', name: 'Mint', from: '#07332a', via: '#047857', to: '#021a15', glow: 'rgba(52,211,153,0.30)' },
  { id: 'emerald', name: 'Emerald', from: '#06321f', via: '#059669', to: '#021a10', glow: 'rgba(52,211,153,0.30)' },
  { id: 'forest', name: 'Forest', from: '#0a2a18', via: '#166534', to: '#04150c', glow: 'rgba(74,222,128,0.28)' },
  { id: 'lime', name: 'Lime', from: '#1a2e07', via: '#4d7c0f', to: '#0c1602', glow: 'rgba(163,230,53,0.28)' },
  { id: 'olive', name: 'Olive', from: '#23280a', via: '#5c6b1a', to: '#0f1206', glow: 'rgba(200,210,120,0.24)' },
  { id: 'slate', name: 'Slate', from: '#1a2230', via: '#334155', to: '#0a0e15', glow: 'rgba(148,163,184,0.26)' },
  { id: 'steel', name: 'Steel', from: '#142028', via: '#334e5c', to: '#0a0f14', glow: 'rgba(125,160,180,0.26)' },
  { id: 'graphite', name: 'Graphite', from: '#1c1c20', via: '#3a3a42', to: '#0c0c0e', glow: 'rgba(160,160,170,0.22)' },
  { id: 'midnight', name: 'Midnight', from: '#0a1020', via: '#1e293b', to: '#04060c', glow: 'rgba(96,165,250,0.26)' },
];

export const DEFAULT_GRADIENT_ID = 'brand-red';

const GRADIENT_BY_ID: Record<string, GradientPreset> = Object.fromEntries(
  GRADIENTS.map((g) => [g.id, g]),
);

export function resolveGradient(id?: string | null): GradientPreset {
  return (id && GRADIENT_BY_ID[id]) || GRADIENT_BY_ID[DEFAULT_GRADIENT_ID];
}

export const CUSTOM_GRADIENT_ID = 'custom';

/** Normalize a user hex to `#rrggbb`, or null if it isn't a valid hex color. */
export function normalizeHex(input: string): string | null {
  let h = input.trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return `#${h}`;
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (rgb: number[]) => `#${rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
const scale = (rgb: number[], f: number) => rgb.map((c) => c * f);
const towardWhite = (rgb: number[], f: number) => rgb.map((c) => c + (255 - c) * f);

/**
 * Build a rich preset from a single hex color, matching the preset recipe:
 * a dark-to-color diagonal fill with a lighter accent glow. White verse text +
 * the contrast scrim stay legible because the fill leans deep.
 */
export function gradientFromHex(input: string): GradientPreset {
  const norm = normalizeHex(input);
  if (!norm) return GRADIENT_BY_ID[DEFAULT_GRADIENT_ID];
  const rgb = toRgb(norm);
  const [r, g, b] = towardWhite(rgb, 0.25);
  return {
    id: CUSTOM_GRADIENT_ID,
    name: 'Custom',
    from: toHex(scale(rgb, 0.32)),
    via: toHex(scale(rgb, 0.6)),
    to: toHex(scale(rgb, 0.14)),
    glow: `rgba(${clamp(r)},${clamp(g)},${clamp(b)},0.34)`,
  };
}
