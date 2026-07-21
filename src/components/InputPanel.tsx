import { useEffect, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import type { LibraryView } from '../lib/libraryView';
import { CollapsibleSection } from './ui';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../lib/appSettings';
import {
  AudioFields,
  BackgroundFields,
  BrandingFields,
  GenerateFooter,
  OutputFields,
  VerseFields,
  outputSummary,
  showAudioFields,
  showBrandingFields,
} from './studio/controls';
import {
  DEFAULT_SECTIONS,
  readStoredSections,
  toggleSection,
  writeStoredSections,
  type SectionKey,
  type SectionState,
} from '../lib/panelLayout';

type Studio = ReturnType<typeof useStudio>;

export function InputPanel({
  studio,
  space = 'ads',
  settings = DEFAULT_APP_SETTINGS,
  onBrowse,
  onGenerate,
}: {
  studio: Studio;
  space?: 'ads' | 'social';
  settings?: AppSettings;
  onBrowse: (view: LibraryView) => void;
  /** When set, used instead of `studio.generate` (e.g. mobile jumps to Preview). */
  onGenerate?: () => void;
}) {
  const [sections, setSections] = useState<SectionState>(DEFAULT_SECTIONS);
  useEffect(() => {
    setSections(readStoredSections());
  }, []);
  const toggle = (key: SectionKey) =>
    setSections((s) => {
      const next = toggleSection(s, key);
      writeStoredSections(next);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-slim flex-1 overflow-y-auto px-7 pb-4 pt-6">
        <CollapsibleSection
          title="Content"
          open={sections.content}
          onToggle={() => toggle('content')}
        >
          <VerseFields studio={studio} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Background"
          open={sections.background}
          onToggle={() => toggle('background')}
        >
          <BackgroundFields studio={studio} onBrowse={onBrowse} />
        </CollapsibleSection>

        {showAudioFields(studio, settings) && (
          <CollapsibleSection title="Audio" open={sections.audio} onToggle={() => toggle('audio')}>
            <AudioFields studio={studio} settings={settings} />
          </CollapsibleSection>
        )}

        {showBrandingFields(studio, settings) && (
          <CollapsibleSection
            title="Branding"
            open={sections.branding}
            onToggle={() => toggle('branding')}
          >
            <BrandingFields studio={studio} />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Output"
          summary={outputSummary(studio)}
          open={sections.output}
          onToggle={() => toggle('output')}
        >
          <OutputFields studio={studio} space={space} />
        </CollapsibleSection>
      </div>

      {/* Sticky footer: generate */}
      <GenerateFooter
        studio={studio}
        onGenerate={onGenerate}
        className="border-t border-line bg-surface px-7 pb-5 pt-4"
      />
    </div>
  );
}
