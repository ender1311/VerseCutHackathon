/** Braze media_library/create is capped at 100 uploads per hour. */
export const BRAZE_HOURLY_LIMIT = 100;

/**
 * Resolve the effective export count for a destination given the "Limit
 * (0 = all)" stepper. AWS/AIR pass through (0 = all). Braze is always capped at
 * its hourly quota — 0 ("all") becomes the cap, and any larger value is clamped —
 * so a run can't blow past the quota and flood failures.
 */
export function effectiveExportLimit(destination: string, limit: number): number {
  if (destination === 'braze') {
    return limit > 0 ? Math.min(limit, BRAZE_HOURLY_LIMIT) : BRAZE_HOURLY_LIMIT;
  }
  return limit;
}
