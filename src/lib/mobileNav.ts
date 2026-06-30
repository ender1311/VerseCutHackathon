export type MobileView = 'edit' | 'preview' | 'library';

export const MOBILE_TABS: { id: MobileView; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
  { id: 'library', label: 'Library' },
];

export function isMobileView(x: unknown): x is MobileView {
  return x === 'edit' || x === 'preview' || x === 'library';
}
