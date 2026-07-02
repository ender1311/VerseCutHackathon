import type { Rect } from './productTemplates';

/**
 * Source-crop + destination rects to cover-fit (center-crop) an image into a
 * slot without distortion. Pure — no canvas.
 */
export function coverRect(
  slot: Rect,
  imgW: number,
  imgH: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const dest = { dx: slot.x, dy: slot.y, dw: slot.w, dh: slot.h };
  if (imgW <= 0 || imgH <= 0) return { sx: 0, sy: 0, sw: 0, sh: 0, ...dest };
  const slotRatio = slot.w / slot.h;
  const imgRatio = imgW / imgH;
  let sw = imgW;
  let sh = imgH;
  if (imgRatio > slotRatio) {
    sw = imgH * slotRatio; // too wide -> crop width
  } else {
    sh = imgW / slotRatio; // too tall -> crop height
  }
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh, ...dest };
}
