import type { AspectRatio } from '@/config';
import type { Passage, PassageQuery } from '@/lib/bible';
import type { LogoStyle } from '@/lib/iconCatalog';
import type { RenderInput, RenderedAsset } from '@/lib/render';
import { resolveBulkLogo } from './logo';
import type { VersionExportRow } from './types';

export interface ExportVersion {
  id: string;
  code: string;
}

export interface VersionExportDeps {
  fetchPassage: (q: PassageQuery) => Promise<Passage>;
  renderImage: (input: RenderInput) => Promise<RenderedAsset>;
  uploadImage: (blob: Blob, fileName: string) => Promise<string>;
}

export interface VersionExportOptions {
  reference: { bookId: string; chapter: number; fromVerse: number; toVerse: number };
  aspect: AspectRatio;
  dimensions: { width: number; height: number };
  logoStyle: LogoStyle;
  gradientId?: string | null;
  gradientHex?: string | null;
  imageUrl?: string | null;
  /** Shared uploaded background image applied to every version. */
  imageFile?: File | null;
  /** Pre-decoded shared background image (avoids per-version decode). */
  backgroundImage?: CanvasImageSource | null;
  /** Pre-computed light/dark theme (avoids per-version luminance sampling). */
  dark?: boolean;
  concurrency?: number;
  isDone?: (versionId: string) => boolean;
  onProgress?: (p: { done: number; total: number; failed: number }) => void;
  onRow?: (row: VersionExportRow) => void;
  /** Called once per version that fails both attempts, with the last error. */
  onError?: (versionId: string, error: unknown) => void;
}

async function exportOne(
  version: ExportVersion,
  deps: VersionExportDeps,
  opts: VersionExportOptions,
): Promise<VersionExportRow> {
  const { reference } = opts;
  const passage = await deps.fetchPassage({
    versionId: version.id,
    bookId: reference.bookId,
    chapter: reference.chapter,
    fromVerse: reference.fromVerse,
    toVerse: reference.toVerse,
  });

  const logo = resolveBulkLogo(version.code, opts.logoStyle);
  const asset = await deps.renderImage({
    passage,
    aspect: opts.aspect,
    dimensions: opts.dimensions,
    imageFile: opts.imageFile ?? null,
    videoFile: null,
    imageUrl: opts.imageUrl ?? null,
    backgroundImage: opts.backgroundImage ?? null,
    dark: opts.dark,
    mimeType: 'image/jpeg',
    languageId: logo.languageId,
    logoStyle: logo.logoStyle,
    template: 'classic',
    gradientId: opts.gradientId ?? null,
    gradientHex: opts.gradientHex ?? null,
  });

  let cdnUrl: string;
  try {
    cdnUrl = await deps.uploadImage(asset.blob, `${version.id}.${asset.ext}`);
  } finally {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(asset.url);
    }
  }
  return {
    version_id: version.id,
    reference: passage.reference,
    verse_text: passage.text,
    air_cdn_link: cdnUrl,
  };
}

/** Run each version through fetch→render→upload with a concurrency pool. A
 *  version that fails is retried once, then recorded with a blank link. */
export async function runVersionExport(
  versions: ExportVersion[],
  deps: VersionExportDeps,
  opts: VersionExportOptions,
): Promise<VersionExportRow[]> {
  const pending = versions.filter((v) => !opts.isDone?.(v.id));
  const total = pending.length;
  const rows: VersionExportRow[] = [];
  let done = 0;
  let failed = 0;
  let next = 0;

  // Callbacks are user-supplied; never let one abort a worker or orphan the pool.
  const safe = (fn: (() => void) | undefined) => {
    try {
      fn?.();
    } catch {
      /* ignore callback errors */
    }
  };

  async function worker() {
    while (next < pending.length) {
      const version = pending[next++];
      let row: VersionExportRow | null = null;
      for (let attempt = 0; attempt < 2 && !row; attempt++) {
        try {
          row = await exportOne(version, deps, opts);
        } catch (err) {
          if (attempt === 0) {
            // Brief backoff with jitter before the single retry.
            await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 350)));
          } else {
            failed++;
            safe(() => opts.onError?.(version.id, err));
            row = {
              version_id: version.id,
              reference: '',
              verse_text: '',
              air_cdn_link: '',
            };
          }
        }
      }
      if (row) {
        rows.push(row);
        const r = row;
        safe(() => opts.onRow?.(r));
      }
      done++;
      safe(() => opts.onProgress?.({ done, total, failed }));
    }
  }

  const poolSize = Math.min(opts.concurrency ?? 10, Math.max(1, pending.length));
  await Promise.all(Array.from({ length: poolSize }, worker));
  return rows;
}
