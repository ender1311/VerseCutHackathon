'use client';

import type { useStudio } from '../../lib/useStudio';
import type { AppSettings, UiMode } from '../../lib/appSettings';
import type { LibraryView } from '../../lib/libraryView';
import { GuidedShell } from './GuidedShell';
import { EverlightShell } from './EverlightShell';
import { EverdarkShell } from './EverdarkShell';
import { TemplatesShell } from './TemplatesShell';

export interface ShellProps {
  studio: ReturnType<typeof useStudio>;
  space: 'ads' | 'social' | 'product';
  settings: AppSettings;
  onBrowse: (view: LibraryView) => void;
}

/** True when a mode uses the dark theme (so the shared header can match). */
export function isDarkMode(mode: UiMode): boolean {
  return mode === 'everdark';
}

export function Shell({ mode, ...props }: { mode: UiMode } & ShellProps) {
  switch (mode) {
    case 'everlight':
      return <EverlightShell {...props} />;
    case 'everdark':
      return <EverdarkShell {...props} />;
    case 'templates':
      return <TemplatesShell {...props} />;
    case 'guided':
    default:
      return <GuidedShell {...props} />;
  }
}
