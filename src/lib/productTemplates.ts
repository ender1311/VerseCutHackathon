// Product-marketing App-Store screenshot templates (Slice A), reconstructed from
// the Figma "App Store collection" (file SYWteUpd8knkgmPrTvFTlJ). The iPhone 14
// Pro device frame is a set of shared vector layers exported from Figma; each
// template supplies a background colour, a headline, an optional subhead/logo,
// and places the device on the canvas. The device-local geometry (bezel,
// speaker, screen slot, dynamic island) came from the `6.9/1-daily-refresh`
// design context. TODAY is pixel-faithful; the other three use the same device
// geometry with their real canvas size, background, and headline copy, and
// approximate headline placement (refined in the editor slice).

export type TemplatePlatform = 'ios';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RoundedRect extends Rect {
  radius: number;
}
export interface DeviceLayer {
  asset: string;
  /** rect in device-local coordinates (device native size below) */
  rect: Rect;
}
export interface DeviceFrame {
  size: { w: number; h: number };
  bodyAsset: string;
  bezel: DeviceLayer;
  speaker: DeviceLayer;
  dynamicIsland: DeviceLayer;
  screenSlot: RoundedRect;
}
export interface TemplateText {
  text: string;
  rect: Rect;
  font: string;
  size: number;
  weight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}
export interface ProductTemplate {
  id: 'today' | 'reader' | 'plans' | 'prayers';
  name: string;
  feature: string;
  platform: TemplatePlatform;
  canvas: { w: number; h: number };
  background: { color: string };
  device: DeviceFrame;
  /** where the device (at native size) is placed on the canvas */
  deviceRect: Rect;
  title: TemplateText;
  subhead?: TemplateText;
  logo?: { asset: string; rect: Rect };
}

const DIR = '/assets/product-templates';

// iPhone 14 Pro — shared vector frame, device-local coords (native 1048.86×2124).
export const IPHONE_14_PRO: DeviceFrame = {
  size: { w: 1048.86, h: 2124 },
  bodyAsset: `${DIR}/frame-iphone-body.svg`,
  bezel: { asset: `${DIR}/frame-bezel.svg`, rect: { x: 26.3, y: 16.8, w: 998.6, h: 2090.5 } },
  speaker: { asset: `${DIR}/frame-speaker.svg`, rect: { x: 422.9, y: 16.8, w: 205.5, h: 7 } },
  dynamicIsland: {
    asset: `${DIR}/frame-dynamic-island.svg`,
    rect: { x: 379.9, y: 81.1, w: 291.5, h: 81.2 },
  },
  screenSlot: { x: 59.7, y: 52.5, w: 931.8, h: 2016.5, radius: 92 },
};

// Substitute sans stack (real headline font Aktiv Grotesk is proprietary; falls
// back to the closest available grotesk/helvetica).
const SANS = "'Aktiv Grotesk', 'Helvetica Neue', Arial, sans-serif";

function deviceRectFor(canvasW: number, y: number): Rect {
  return { x: Math.round((canvasW - IPHONE_14_PRO.size.w) / 2), y, w: IPHONE_14_PRO.size.w, h: IPHONE_14_PRO.size.h };
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: 'today',
    name: 'Today feed',
    feature: 'daily-refresh',
    platform: 'ios',
    canvas: { w: 1320, h: 2868 },
    background: { color: '#7a2629' },
    device: IPHONE_14_PRO,
    deviceRect: { x: 136, y: 652, w: IPHONE_14_PRO.size.w, h: IPHONE_14_PRO.size.h },
    title: {
      text: 'Start your day with God’s Word',
      rect: { x: 90, y: 105, w: 1128, h: 336 },
      font: SANS,
      size: 149,
      weight: 700,
      color: '#fef5eb',
      align: 'left',
      lineHeight: 157,
    },
    logo: { asset: `${DIR}/youversion-logo.svg`, rect: { x: 90, y: 456, w: 578.64, h: 60 } },
  },
  {
    id: 'reader',
    name: 'Reader',
    feature: 'bible',
    platform: 'ios',
    canvas: { w: 1320, h: 2868 },
    background: { color: '#fef5eb' },
    device: IPHONE_14_PRO,
    deviceRect: deviceRectFor(1320, 652),
    title: {
      text: '100% Free',
      rect: { x: 90, y: 110, w: 640, h: 260 },
      font: SANS,
      size: 120,
      weight: 700,
      color: '#121212',
      align: 'left',
      lineHeight: 126,
    },
    subhead: {
      text: 'No ads or purchases',
      rect: { x: 760, y: 130, w: 470, h: 160 },
      font: SANS,
      size: 40,
      weight: 500,
      color: '#121212',
      align: 'right',
      lineHeight: 48,
    },
  },
  {
    id: 'plans',
    name: 'Plans',
    feature: 'plans',
    platform: 'ios',
    canvas: { w: 1242, h: 2868 },
    background: { color: '#fef5eb' },
    device: IPHONE_14_PRO,
    deviceRect: deviceRectFor(1242, 652),
    title: {
      text: 'Build a daily Bible habit with plans',
      rect: { x: 90, y: 110, w: 1062, h: 320 },
      font: SANS,
      size: 96,
      weight: 700,
      color: '#121212',
      align: 'left',
      lineHeight: 104,
    },
  },
  {
    id: 'prayers',
    name: 'Prayers',
    feature: 'guided-prayer',
    platform: 'ios',
    canvas: { w: 1242, h: 2868 },
    background: { color: '#fef5eb' },
    device: IPHONE_14_PRO,
    deviceRect: deviceRectFor(1242, 652),
    title: {
      text: 'Start a conversation with God through prayer',
      rect: { x: 90, y: 110, w: 1062, h: 340 },
      font: SANS,
      size: 92,
      weight: 700,
      color: '#121212',
      align: 'left',
      lineHeight: 100,
    },
  },
];
