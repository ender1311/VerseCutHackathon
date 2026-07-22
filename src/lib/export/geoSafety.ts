// Neutral-landmark filter for geo backgrounds. Reject religious (any faith),
// political, or conflict imagery by scanning the photo description.
const BLOCKED_TERMS = [
  // religion (all faiths — geo backgrounds should be neutral)
  'church', 'cathedral', 'mosque', 'synagogue', 'temple', 'shrine', 'chapel',
  'worship', 'prayer', 'pray', 'religion', 'religious', 'holy', 'sacred',
  'cross', 'crucifix', 'buddha', 'buddhist', 'hindu', 'islam', 'islamic',
  'muslim', 'christian', 'christ', 'jesus', 'bible', 'quran', 'koran', 'torah',
  'monk', 'nun', 'priest', 'imam', 'rabbi',
  // politics + conflict
  'protest', 'politic', 'election', 'riot', 'war', 'military', 'soldier',
  'weapon', 'gun', 'army', 'battle', 'demonstration',
];

// Match blocked terms only as whole words, so substrings like "war" in
// "Warsaw" or "cross" in "crossing" don't reject legitimate landmark photos.
const BLOCKED_RE = new RegExp(
  `\\b(${BLOCKED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i',
);

export function isSafeGeoPhoto(photo: { description: string | null }): boolean {
  return !BLOCKED_RE.test(photo.description ?? '');
}
