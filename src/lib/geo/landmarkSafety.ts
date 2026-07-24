// Christian-friendly safety filter for the geo landmark picker. Blocks
// political / military imagery and NON-Christian worship, but ALLOWS Christian
// references (church, cathedral, cross) and always allows the selected landmark
// itself — so an explicitly chosen landmark (e.g. the Taj Mahal) is never
// filtered out for being religious.
//
// Deliberately separate from src/lib/export/geoSafety.ts, which stays strictly
// neutral (blocks all faiths) for the bulk-export geo backgrounds feature.
const BLOCKED_TERMS = [
  // non-Christian worship / religion
  'mosque', 'synagogue', 'temple', 'shrine', 'buddha', 'buddhist', 'hindu',
  'hinduism', 'islam', 'islamic', 'muslim', 'quran', 'koran', 'torah', 'imam',
  'rabbi', 'idol', 'deity', 'mandir', 'gurdwara', 'sikh', 'shinto', 'pagoda',
  // politics + conflict
  'protest', 'politic', 'election', 'riot', 'war', 'military', 'soldier',
  'weapon', 'gun', 'army', 'battle', 'demonstration',
];

// Match blocked terms as whole words with an optional plural suffix, so
// "soldiers"/"temples" are caught while substrings like "war" in "Warsaw" are
// not (the trailing boundary still fails inside a larger word).
const BLOCKED_RE = new RegExp(
  `\\b(${BLOCKED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:s|es)?\\b`,
  'i',
);

/**
 * True when a landmark photo is safe to show. The selected landmark term is
 * always allowed; otherwise reject political/military or non-Christian-worship
 * imagery by scanning the photo description. Photos with no description pass.
 */
export function isLandmarkPhotoSafe(
  description: string | null,
  landmarkTerm: string,
): boolean {
  const desc = description ?? '';
  if (landmarkTerm && desc.toLowerCase().includes(landmarkTerm.toLowerCase())) {
    return true;
  }
  return !BLOCKED_RE.test(desc);
}
