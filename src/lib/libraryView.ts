/** The background/asset library tabs a "Browse library" action can open. */
export type LibraryView = 'youversion' | 'unsplash' | 'videos' | 'generated';

export const LIBRARY_TABS: { id: LibraryView; label: string }[] = [
  { id: 'youversion', label: 'YouVersion' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'videos', label: 'Videos' },
  { id: 'generated', label: 'Saved assets' },
];
