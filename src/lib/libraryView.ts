/** The background/asset library tabs a "Browse library" action can open. */
export type LibraryView = 'youversion' | 'unsplash' | 'geo' | 'videos' | 'generated';

export const LIBRARY_TABS: { id: LibraryView; label: string }[] = [
  { id: 'youversion', label: 'YouVersion' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'geo', label: 'Geo' },
  { id: 'videos', label: 'Videos' },
  { id: 'generated', label: 'Saved assets' },
];
