// Canvas compositor shared by the static-image and video render paths.
// Draws: background (cover-fit image/video or generated gradient) → contrast
// scrim → verse text → reference/version → bottom-left logo.

import { resolveGradient, type GradientPreset } from './gradients';

export type Background =
  | { type: 'image'; image: CanvasImageSource }
  | { type: 'video'; video: HTMLVideoElement }
  | { type: 'gradient'; preset?: GradientPreset };

export interface VerseFontInfo {
  family: string;
  rtl: boolean;
  /** Latin/Cyrillic/Greek uppercase the reference; complex scripts must not. */
  script: string;
}

export interface ComposeOptions {
  width: number;
  height: number;
  verseText: string;
  reference: string;
  versionAbbreviation: string;
  background: Background;
  logo: CanvasImageSource | null;
  /** 0..1 animation progress (1 = fully revealed). Use 1 for static images. */
  t?: number;
  /** Script-aware verse font (defaults to Latin/Fraunces, LTR). */
  verseFont?: VerseFontInfo;
  /** Draw a light plate behind the logo (for dark-artwork "light" lockups). */
  logoPlate?: boolean;
  /** Layout template. 'classic' = dark scrim + corner logo; 'promo' = light, centered lockup + CTA. */
  template?: 'classic' | 'promo';
  /** Call-to-action line (promo template), e.g. "Download the Bible App!". */
  cta?: string;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  scale = 1,
) {
  if (!sw || !sh) return;
  const baseScale = Math.max(dw / sw, dh / sh) * scale;
  const w = sw * baseScale;
  const h = sh * baseScale;
  ctx.drawImage(src, (dw - w) / 2, (dh - h) / 2, w, h);
}

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  preset?: GradientPreset,
) {
  const p = resolveGradient(preset?.id);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.from);
  g.addColorStop(0.5, p.via);
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft accent glow toward the top.
  const radial = ctx.createRadialGradient(
    w * 0.5,
    h * 0.18,
    0,
    w * 0.5,
    h * 0.18,
    Math.max(w, h) * 0.8,
  );
  radial.addColorStop(0, p.glow);
  radial.addColorStop(1, p.glow.replace(/,[^,]*\)$/, ',0)'));
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
}

/** Wrap text to fit maxWidth at the given font size. Returns the lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  // Character-aware greedy wrap: breaks at spaces for space-delimited scripts
  // (Latin/Cyrillic/Arabic) and between characters for scripts without spaces
  // (CJK/Japanese/Thai), so no line overflows the text box.
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (line && ctx.measureText(test).width > maxWidth) {
      const lastSpace = line.lastIndexOf(' ');
      if (lastSpace > 0) {
        lines.push(line.slice(0, lastSpace));
        line = line.slice(lastSpace + 1) + ch;
      } else {
        lines.push(line);
        line = ch;
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Pick the largest serif size that fits the verse within the text box and a
 * sensible line budget, then return the wrapped lines + chosen size.
 */
function fitVerse(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  family: string,
) {
  const font = (px: number) => `600 ${px}px '${family}', Georgia, serif`;
  let size = startSize;
  const minSize = Math.round(startSize * 0.42);
  while (size > minSize) {
    ctx.font = font(size);
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.32;
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, size, lineHeight };
    }
    size -= 4;
  }
  ctx.font = font(minSize);
  const lineHeight = minSize * 1.32;
  const allLines = wrapText(ctx, text, maxWidth);
  // Even at the smallest size the verse may not fit; clamp the line count to the
  // height budget (with an ellipsis) so it never overflows off-canvas (classic)
  // or into the CTA/logo (promo).
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  if (allLines.length <= maxLines) {
    return { lines: allLines, size: minSize, lineHeight };
  }
  const lines = allLines.slice(0, maxLines);
  lines[lines.length - 1] =
    lines[lines.length - 1].replace(/[\s'"”’).,;:]+$/, '') + '…';
  return { lines, size: minSize, lineHeight };
}

export function composeFrame(
  ctx: CanvasRenderingContext2D,
  opts: ComposeOptions,
) {
  if (opts.template === 'promo') {
    composePromo(ctx, opts);
    return;
  }

  const { width: w, height: h, background, logo } = opts;
  const t = opts.t ?? 1;
  const reveal = easeOut(Math.min(1, t / 0.5)); // text fully in by t=0.5

  ctx.clearRect(0, 0, w, h);

  // 1. Background
  if (background.type === 'gradient') {
    drawGradientBackground(ctx, w, h, background.preset);
  } else if (background.type === 'image') {
    const img = background.image as HTMLImageElement;
    const zoom = 1.04 + 0.06 * t; // slow Ken Burns
    drawCover(ctx, img, img.naturalWidth, img.naturalHeight, w, h, zoom);
  } else {
    const v = background.video;
    const zoom = 1.02 + 0.04 * t;
    drawCover(ctx, v, v.videoWidth, v.videoHeight, w, h, zoom);
  }

  // 2. Contrast: global darken + stronger bottom scrim
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, w, h);

  const scrim = ctx.createLinearGradient(0, h * 0.32, 0, h);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  // 3. Layout metrics
  const margin = Math.round(w * 0.075);
  const textMaxWidth = w - margin * 2;
  const logoSize = Math.round(Math.min(w, h) * 0.085);
  const logoBaselineY = h - margin - logoSize;

  // Script-aware verse font + direction.
  const vf = opts.verseFont ?? { family: 'Fraunces', rtl: false, script: 'latin' };
  const rtl = vf.rtl;
  const casedScript = vf.script === 'latin' || vf.script === 'cyrillic' || vf.script === 'greek';
  const anchorX = rtl ? w - margin : margin;
  const align: CanvasTextAlign = rtl ? 'right' : 'left';

  // 4. Verse text (anchored above the logo row)
  const verseBudgetH = h * (background.type === 'gradient' ? 0.5 : 0.42);
  const startSize = Math.round(w * 0.062);
  const { lines, size, lineHeight } = fitVerse(
    ctx,
    `“${opts.verseText}”`,
    textMaxWidth,
    verseBudgetH,
    startSize,
    vf.family,
  );

  const refSize = Math.round(size * 0.42);
  const refGap = refSize * 2.4;
  const blockHeight = lines.length * lineHeight + refGap;
  let baselineY = logoBaselineY - Math.round(h * 0.04) - blockHeight + lineHeight;

  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.translate(0, (1 - reveal) * 24);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = Math.round(size * 0.25);
  ctx.shadowOffsetY = 2;
  ctx.font = `600 ${size}px '${vf.family}', Georgia, serif`;
  for (const line of lines) {
    ctx.fillText(line, anchorX, baselineY);
    baselineY += lineHeight;
  }
  ctx.restore();

  // 5. Reference + version (brand-tinted). Latin/Cyrillic/Greek get the tracked
  //    uppercase treatment; complex scripts are drawn as-is (no letter-spacing,
  //    which would break shaping/ligatures).
  ctx.save();
  ctx.globalAlpha = easeOut(Math.min(1, Math.max(0, (t - 0.25) / 0.5)));
  ctx.fillStyle = '#fe5562';
  const refText = casedScript ? opts.reference.toUpperCase() : opts.reference;
  const label = opts.versionAbbreviation
    ? `${refText}  ·  ${opts.versionAbbreviation}`
    : refText;
  const refFamily = casedScript ? 'Plus Jakarta Sans' : vf.family;
  const refFontAt = (px: number) => `700 ${px}px '${refFamily}', system-ui, sans-serif`;
  const fittedRef = fitTextSize(ctx, label, textMaxWidth, refSize, refFontAt, casedScript ? 0.08 : 0);
  const lsY = baselineY - lineHeight + refGap * 0.7;
  if (casedScript) {
    ctx.textAlign = 'left';
    drawTracked(ctx, label, margin, lsY, fittedRef * 0.08);
  } else {
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = align;
    ctx.fillText(label, anchorX, lsY);
  }
  ctx.restore();

  // 6. Logo bottom-left — drawn at a fixed height, preserving aspect ratio so
  //    wide wordmark lockups don't get squished into a square.
  if (logo) {
    const nat = logo as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
    const natW = nat.naturalWidth || (typeof nat.width === 'number' ? nat.width : 0) || logoSize;
    const natH = nat.naturalHeight || (typeof nat.height === 'number' ? nat.height : 0) || logoSize;
    const aspect = natW > 0 && natH > 0 ? natW / natH : 1;
    const logoW = Math.round(logoSize * aspect);
    ctx.save();
    ctx.globalAlpha = reveal;
    if (opts.logoPlate) {
      // Light rounded plate so dark-artwork "light" lockups stay legible on the
      // dark scrim.
      const pad = Math.round(logoSize * 0.28);
      const r = Math.round(logoSize * 0.22);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(margin - pad, logoBaselineY - pad, logoW + pad * 2, logoSize + pad * 2, r);
      ctx.fill();
    }
    ctx.drawImage(logo, margin, logoBaselineY, logoW, logoSize);
    ctx.restore();
  }
}

function drawLightGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#eef4fb');
  g.addColorStop(0.5, '#dfeaf5');
  g.addColorStop(1, '#cfe0ef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * App-promo template: light photographic/gradient background, dark teal serif
 * verse (upper, left-aligned), centered reference, a CTA line, and the Bible App
 * lockup centered at the bottom. Mirrors the reference promo video.
 */
function composePromo(ctx: CanvasRenderingContext2D, opts: ComposeOptions) {
  const { width: w, height: h, background, logo } = opts;
  const t = opts.t ?? 1;
  const vf = opts.verseFont ?? { family: 'Fraunces', rtl: false, script: 'latin' };
  const reveal = easeOut(Math.min(1, t / 0.45));
  const detail = easeOut(Math.min(1, Math.max(0, (t - 0.3) / 0.5)));
  const casedScript =
    vf.script === 'latin' || vf.script === 'cyrillic' || vf.script === 'greek';
  const uiFamily = casedScript ? 'Plus Jakarta Sans' : vf.family;

  ctx.clearRect(0, 0, w, h);

  // 1. Light background
  if (background.type === 'gradient') {
    drawLightGradient(ctx, w, h);
  } else if (background.type === 'image') {
    const img = background.image as HTMLImageElement;
    drawCover(ctx, img, img.naturalWidth, img.naturalHeight, w, h, 1.04 + 0.05 * t);
  } else {
    const v = background.video;
    drawCover(ctx, v, v.videoWidth, v.videoHeight, w, h, 1.02 + 0.04 * t);
  }
  // Soft white veil so dark text stays legible over any background.
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillRect(0, 0, w, h);

  const margin = Math.round(w * 0.085);
  const maxW = w - margin * 2;
  const rtl = vf.rtl;
  const anchorX = rtl ? w - margin : margin;

  // 2. Verse — dark teal serif, upper area
  const startSize = Math.round(w * 0.066);
  const { lines, size, lineHeight } = fitVerse(
    ctx,
    `“${opts.verseText}”`,
    maxW,
    h * 0.4,
    startSize,
    vf.family,
  );
  const verseTopBaseline = Math.round(h * 0.16) + size;
  let y = verseTopBaseline;
  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.translate(0, (1 - reveal) * 18);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#33514b';
  ctx.font = `600 ${size}px '${vf.family}', Georgia, serif`;
  for (const line of lines) {
    ctx.fillText(line, anchorX, y);
    y += lineHeight;
  }
  ctx.restore();
  const verseBottom = y - lineHeight; // baseline of the final verse line

  // 3. Reference — centered, muted, flowed just below the verse so longer
  //    passages (or shorter canvases like 16:9) never collide with the verse.
  const label = opts.versionAbbreviation
    ? `${opts.reference}   ${opts.versionAbbreviation}`
    : opts.reference;
  const refY = Math.max(Math.round(h * 0.58), Math.round(verseBottom + lineHeight * 0.95));
  ctx.save();
  ctx.globalAlpha = detail;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5b6b68';
  fitTextSize(ctx, label, maxW, Math.round(w * 0.038), (px) => `600 ${px}px '${uiFamily}', system-ui, sans-serif`);
  ctx.fillText(label, w / 2, refY);
  ctx.restore();

  // 4. CTA — centered, bold dark
  if (opts.cta) {
    ctx.save();
    ctx.globalAlpha = detail;
    ctx.translate(0, (1 - detail) * 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a1a1a';
    fitTextSize(ctx, opts.cta, maxW, Math.round(w * 0.052), (px) => `800 ${px}px '${uiFamily}', system-ui, sans-serif`);
    ctx.fillText(opts.cta, w / 2, Math.round(h * 0.8));
    ctx.restore();
  }

  // 5. Logo lockup — centered, bottom
  if (logo) {
    const nat = logo as { naturalWidth?: number; naturalHeight?: number };
    const aspect = (nat.naturalWidth || 1) / (nat.naturalHeight || 1);
    const targetH = Math.round(w * 0.1);
    const lw = Math.round(targetH * aspect);
    ctx.save();
    ctx.globalAlpha = detail;
    ctx.drawImage(logo, Math.round(w / 2 - lw / 2), Math.round(h * 0.855), lw, targetH);
    ctx.restore();
  }
}

/**
 * Largest font size (down to half the start size) at which `text` fits within
 * `maxWidth` on one line. `trackingFrac` accounts for per-character letter
 * spacing (as a fraction of the font size) used by drawTracked. Leaves ctx.font
 * set to the chosen size.
 */
function fitTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  fontAt: (px: number) => string,
  trackingFrac = 0,
): number {
  let px = startPx;
  const min = Math.max(8, Math.round(startPx * 0.5));
  for (; px > min; px -= 2) {
    ctx.font = fontAt(px);
    const tracking = trackingFrac ? px * trackingFrac * text.length : 0;
    if (ctx.measureText(text).width + tracking <= maxWidth) break;
  }
  ctx.font = fontAt(px);
  return px;
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + letterSpacing;
  }
}

/** Ensure web fonts are available before drawing to canvas. */
export async function ensureFontsReady() {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load("600 80px 'Fraunces'"),
      document.fonts.load("700 32px 'Plus Jakarta Sans'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to system serif/sans */
  }
}
