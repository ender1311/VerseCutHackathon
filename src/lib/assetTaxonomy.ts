export type AssetSource = 'youversion' | 'unsplash' | 'pexels' | 'other';

/** Classify a shared asset by its seeded name prefix (used for backfill). */
export function deriveSource(name: string): AssetSource {
  const n = name.trim();
  if (n.startsWith('YouVersion')) return 'youversion';
  if (n.startsWith('Unsplash')) return 'unsplash';
  if (n.startsWith('Pexels')) return 'pexels';
  return 'other';
}

export function orientationOf(width: number, height: number): 'portrait' | 'landscape' {
  return height > width ? 'portrait' : 'landscape';
}

/**
 * Parse a seeded YouVersion asset name: "YouVersion · <usfm> · <lang> · <id>".
 * Returns null if it doesn't match that shape.
 */
export function parseYouVersionName(
  name: string,
): { usfm: string; language: string; id: string } | null {
  const parts = name.split('·').map((p) => p.trim());
  if (parts.length !== 4 || parts[0] !== 'YouVersion') return null;
  return { usfm: parts[1], language: parts[2], id: parts[3] };
}
