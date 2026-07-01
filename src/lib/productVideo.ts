export type ProductVideoInput = {
  feature: string;
  title: string;
  length: string;
  lang: string;
  orientation: string;
  fileUrl: string;
  mime?: string | null;
  sizeBytes?: number | null;
};

// Matches "<feature>-<length>-<lang>-<orientation>.mp4" (same shape as pm.ts listOutputs).
export function parseOutputName(
  name: string,
): { length: string; lang: string; orientation: string } | null {
  const m = name.replace(/\.mp4$/, '').match(/-(short|long)-([a-z]{2})-(portrait|landscape)$/);
  if (!m) return null;
  return { length: m[1], lang: m[2], orientation: m[3] };
}
