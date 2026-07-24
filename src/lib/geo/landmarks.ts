export interface GeoLandmark {
  /** Stable key used in UI state + tests (lowercase ISO-ish country code). */
  code: string;
  /** Display name shown in the country dropdown. */
  country: string;
  /** Unsplash search term for this country's iconic landmark. */
  term: string;
  /** True for the "all landmarks" option — a broad mix rather than one country. */
  generic?: boolean;
}

// Curated, instantly-recognizable landmarks. The first entry is a generic "all
// landmarks" option (the default) so the Geo tab opens on a varied worldwide
// mix; the rest map a country to its iconic landmark. Terms are tuned for
// strong Unsplash results.
export const GEO_LANDMARKS: GeoLandmark[] = [
  { code: 'all', country: 'All landmarks', term: 'landmarks', generic: true },
  { code: 'in', country: 'India', term: 'Taj Mahal' },
  { code: 'fr', country: 'France', term: 'Eiffel Tower' },
  { code: 'us', country: 'United States', term: 'Statue of Liberty' },
  { code: 'gb', country: 'United Kingdom', term: 'Big Ben London' },
  { code: 'it', country: 'Italy', term: 'Colosseum Rome' },
  { code: 'br', country: 'Brazil', term: 'Christ the Redeemer Rio' },
  { code: 'eg', country: 'Egypt', term: 'Pyramids of Giza' },
  { code: 'au', country: 'Australia', term: 'Sydney Opera House' },
  { code: 'jp', country: 'Japan', term: 'Mount Fuji' },
  { code: 'cn', country: 'China', term: 'Great Wall of China' },
  { code: 'de', country: 'Germany', term: 'Brandenburg Gate' },
  { code: 'es', country: 'Spain', term: 'Sagrada Familia' },
  { code: 'gr', country: 'Greece', term: 'Acropolis Athens' },
  { code: 'mx', country: 'Mexico', term: 'Chichen Itza' },
  { code: 'pe', country: 'Peru', term: 'Machu Picchu' },
  { code: 'jo', country: 'Jordan', term: 'Petra Jordan' },
  { code: 'za', country: 'South Africa', term: 'Table Mountain Cape Town' },
  { code: 'nl', country: 'Netherlands', term: 'Amsterdam canals' },
  { code: 'ru', country: 'Russia', term: "Saint Basil's Cathedral" },
  { code: 'ar', country: 'Argentina', term: 'Obelisco Buenos Aires' },
  { code: 'ca', country: 'Canada', term: 'CN Tower Toronto' },
  { code: 'ae', country: 'United Arab Emirates', term: 'Burj Khalifa Dubai' },
  { code: 'ch', country: 'Switzerland', term: 'Matterhorn' },
  { code: 'no', country: 'Norway', term: 'Norway fjords' },
];

export const DEFAULT_GEO_LANDMARK = GEO_LANDMARKS[0];

/** Landmark for a country code, falling back to the default (India). */
export function getGeoLandmark(code: string): GeoLandmark {
  return GEO_LANDMARKS.find((l) => l.code === code) ?? DEFAULT_GEO_LANDMARK;
}
