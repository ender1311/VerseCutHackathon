'use client';

import type { ProductTemplate, Rect, RoundedRect, TemplateText } from './productTemplates';
import { coverRect } from './templateGeometry';
import { wrapLines } from './templateText';
import { ensureFontsReady } from './compositor';

export type TemplateFills = { screenImage?: CanvasImageSource; title?: string; subhead?: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, r: RoundedRect) {
  const rr = Math.min(r.radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rr, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
  ctx.closePath();
}

/** device-local rect -> absolute canvas rect (device drawn at native size) */
function abs(deviceRect: Rect, local: Rect): Rect {
  return { x: deviceRect.x + local.x, y: deviceRect.y + local.y, w: local.w, h: local.h };
}

function drawText(ctx: CanvasRenderingContext2D, t: TemplateText, override?: string) {
  const text = override ?? t.text;
  ctx.save();
  ctx.font = `${t.weight} ${t.size}px ${t.font}`;
  ctx.fillStyle = t.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = t.align;
  const lines = wrapLines((s) => ctx.measureText(s).width, text, t.rect.w);
  const anchorX =
    t.align === 'left' ? t.rect.x : t.align === 'right' ? t.rect.x + t.rect.w : t.rect.x + t.rect.w / 2;
  lines.forEach((line, i) => ctx.fillText(line, anchorX, t.rect.y + i * t.lineHeight));
  ctx.restore();
}

export type DeviceAssets = {
  body: HTMLImageElement;
  bezel: HTMLImageElement;
  speaker: HTMLImageElement;
  dynamicIsland: HTMLImageElement;
};

export function composeTemplate(
  ctx: CanvasRenderingContext2D,
  template: ProductTemplate,
  fills: TemplateFills,
  assets: { device: DeviceAssets; logo?: HTMLImageElement },
) {
  const { canvas, deviceRect, device } = template;
  // background
  ctx.fillStyle = template.background.color;
  ctx.fillRect(0, 0, canvas.w, canvas.h);
  // device body + black bezel + speaker (behind the screen)
  ctx.drawImage(assets.device.body, deviceRect.x, deviceRect.y, deviceRect.w, deviceRect.h);
  const bezel = abs(deviceRect, device.bezel.rect);
  ctx.drawImage(assets.device.bezel, bezel.x, bezel.y, bezel.w, bezel.h);
  const spk = abs(deviceRect, device.speaker.rect);
  ctx.drawImage(assets.device.speaker, spk.x, spk.y, spk.w, spk.h);
  // screen image, clipped to the slot's rounded rect
  const slotAbs: RoundedRect = { ...abs(deviceRect, device.screenSlot), radius: device.screenSlot.radius };
  ctx.save();
  roundedRectPath(ctx, slotAbs);
  ctx.clip();
  if (fills.screenImage) {
    const el = fills.screenImage as HTMLImageElement;
    const c = coverRect(slotAbs, el.naturalWidth || slotAbs.w, el.naturalHeight || slotAbs.h);
    ctx.drawImage(fills.screenImage, c.sx, c.sy, c.sw, c.sh, c.dx, c.dy, c.dw, c.dh);
  } else {
    ctx.fillStyle = '#e7e7ea';
    ctx.fillRect(slotAbs.x, slotAbs.y, slotAbs.w, slotAbs.h);
  }
  ctx.restore();
  // dynamic island on top of the screen
  const di = abs(deviceRect, device.dynamicIsland.rect);
  ctx.drawImage(assets.device.dynamicIsland, di.x, di.y, di.w, di.h);
  // copy + logo
  drawText(ctx, template.title, fills.title);
  if (template.subhead) drawText(ctx, template.subhead, fills.subhead);
  if (template.logo && assets.logo) {
    const l = template.logo.rect;
    ctx.drawImage(assets.logo, l.x, l.y, l.w, l.h);
  }
}

export async function renderTemplate(template: ProductTemplate, fills: TemplateFills): Promise<Blob> {
  await ensureFontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = template.canvas.w;
  canvas.height = template.canvas.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const d = template.device;
  const [body, bezel, speaker, dynamicIsland] = await Promise.all([
    loadImage(d.bodyAsset),
    loadImage(d.bezel.asset),
    loadImage(d.speaker.asset),
    loadImage(d.dynamicIsland.asset),
  ]);
  const logo = template.logo ? await loadImage(template.logo.asset) : undefined;
  composeTemplate(ctx, template, fills, { device: { body, bezel, speaker, dynamicIsland }, logo });
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
