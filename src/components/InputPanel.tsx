import { useEffect, useState } from 'react';
import type { useStudio } from '../lib/useStudio';
import type { RightView } from './RightPanel';
import { ChevronDown, ImageIcon, Play, Spinner, VideoIcon, XMark } from './icons';
import { Button, CollapsibleSection, FieldLabel, Segmented, Select, Stepper, UploadField } from './ui';
import { SOCIAL_FORMATS } from '../lib/socialFormats';
import {
  DEFAULT_SECTIONS,
  readStoredSections,
  toggleSection,
  writeStoredSections,
  type SectionKey,
  type SectionState,
} from '../lib/panelLayout';

type Studio = ReturnType<typeof useStudio>;

function BrowseEntry({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        <div className="text-[12px] text-faint">{hint}</div>
      </div>
      <ChevronDown className="-rotate-90 text-faint" />
    </button>
  );
}

function SelectedChip({
  icon,
  title,
  subtitle,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClear: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-ink">{title}</div>
        <div className="truncate text-[12px] text-faint">{subtitle}</div>
      </div>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
      >
        <XMark />
      </button>
    </div>
  );
}

function GradientPicker({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  const current =
    studio.gradients.find((g) => g.id === studio.gradientId) ?? studio.gradients[0];
  const swatch = (g: { from: string; via: string; to: string }) =>
    `linear-gradient(135deg, ${g.from} 0%, ${g.via} 50%, ${g.to} 100%)`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint"
      >
        <span
          className="h-9 w-9 shrink-0 rounded-lg border border-line"
          style={{ backgroundImage: swatch(current) }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">
            Background gradient
          </span>
          <span className="block text-[12px] text-faint">{current.name}</span>
        </span>
        <ChevronDown className={`text-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-8 gap-2">
          {studio.gradients.map((g) => {
            const selected = studio.gradientId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                title={g.name}
                aria-label={g.name}
                aria-pressed={selected}
                onClick={() => studio.setGradientId(g.id)}
                className={`aspect-square rounded-lg border transition ${
                  selected
                    ? 'border-brand ring-2 ring-brand/40'
                    : 'border-line hover:border-faint'
                }`}
                style={{ backgroundImage: swatch(g) }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InputPanel({
  studio,
  space = 'ads',
  onBrowse,
}: {
  studio: Studio;
  space?: 'ads' | 'social' | 'product';
  onBrowse: (view: RightView) => void;
}) {
  const rendering = studio.isRendering;
  const libVideo = studio.libraryVideo;
  const sharedBg = studio.sharedBg;
  const hasBgSource =
    !!studio.imageFile || !!studio.videoFile || !!studio.libraryVideo || !!studio.sharedBg;

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
  const showAudio = studio.format === 'video';
  const showBranding = studio.template === 'classic';

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-slim @container flex-1 overflow-y-auto px-7 pt-6 pb-4">
        {/* CONTENT */}
        <CollapsibleSection
          title="Content"
          open={sections.content}
          onToggle={() => toggle('content')}
        >
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 @[560px]:grid-cols-2">
            <div>
              <FieldLabel required>Language</FieldLabel>
              <Select
                value={studio.languageId}
                onChange={studio.setLanguageId}
                placeholder="Select a language"
                options={studio.languages.map((l) => ({
                  value: l.id,
                  label: l.name,
                  group: l.group,
                }))}
              />
            </div>

            <div className="@[560px]:col-span-2">
              <FieldLabel required hint="Book · chapter · verses">
                Verse range
              </FieldLabel>
              <Select
                value={studio.bookId}
                onChange={studio.setBookId}
                placeholder="Select a book"
                options={studio.books.map((b) => ({ value: b.id, label: b.name }))}
              />
              <div className="mt-3 flex gap-3">
                <Stepper
                  label="Chapter"
                  value={studio.chapter}
                  min={1}
                  max={studio.maxChapter}
                  onChange={studio.setChapter}
                />
                <Stepper
                  label="From v."
                  value={studio.fromVerse}
                  min={1}
                  max={studio.maxVerse}
                  onChange={studio.setFrom}
                />
                <Stepper
                  label="To v."
                  value={studio.toVerse}
                  min={studio.fromVerse}
                  max={studio.maxVerse}
                  onChange={studio.setTo}
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="Layout">Template</FieldLabel>
              <Segmented
                value={studio.template}
                onChange={studio.setTemplate}
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'promo', label: 'App promo' },
                ]}
              />
            </div>

            <div>
              <FieldLabel hint={`${studio.versions.length} available`}>Bible version</FieldLabel>
              <Select
                value={studio.versionId}
                onChange={studio.setVersionId}
                disabled={studio.versions.length === 0}
                options={studio.versions.map((v) => ({
                  value: v.id,
                  label: `${v.abbreviation} — ${v.name}`,
                }))}
              />
            </div>

            {studio.template === 'promo' && (
              <div className="@[560px]:col-span-2">
                <FieldLabel hint="Shown above the logo">Call to action</FieldLabel>
                <input
                  type="text"
                  value={studio.cta}
                  onChange={(e) => studio.setCta(e.target.value)}
                  placeholder="Download the Bible App!"
                  className="h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-base font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 md:text-[15px]"
                />
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* BACKGROUND */}
        <CollapsibleSection
          title="Background"
          open={sections.background}
          onToggle={() => toggle('background')}
        >
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 @[560px]:grid-cols-2">
            <div>
              <UploadField
                label="Background image"
                hint="JPG / PNG"
                accept="image/png,image/jpeg"
                icon={<ImageIcon />}
                file={studio.imageFile}
                onSelect={(f) => studio.setImageFile(f)}
                onClear={() => studio.setImageFile(null)}
              />
            </div>

            <div>
              <UploadField
                label="Background video"
                hint="MP4 / WEBM / MOV"
                accept="video/mp4,video/webm,video/quicktime"
                icon={<VideoIcon />}
                file={studio.videoFile}
                onSelect={(f) => studio.setVideoFile(f)}
                onClear={() => studio.setVideoFile(null)}
              />
            </div>

            <div>
              <FieldLabel hint="YouVersion · by date">Video library</FieldLabel>
              {libVideo && (
                <SelectedChip
                  icon={<VideoIcon />}
                  title={libVideo.entry.title}
                  subtitle={libVideo.entry.language.toUpperCase()}
                  onClear={studio.clearLibraryVideo}
                />
              )}
              <BrowseEntry
                icon={<VideoIcon />}
                title="Browse YouVersion videos"
                hint="Pick a Guided Scripture video by date"
                onClick={() => onBrowse('videos')}
              />
            </div>

            <div>
              <FieldLabel hint="Reusable backgrounds">Background library</FieldLabel>
              {sharedBg && (
                <SelectedChip
                  icon={sharedBg.kind === 'video' ? <VideoIcon /> : <ImageIcon />}
                  title={sharedBg.label}
                  subtitle={sharedBg.kind === 'video' ? 'Shared video background' : 'Shared background'}
                  onClear={studio.clearSharedBg}
                />
              )}
              <BrowseEntry
                icon={<ImageIcon />}
                title="Browse the background library"
                hint="Reusable team backgrounds · images + video"
                onClick={() => onBrowse('images')}
              />
            </div>

            {!hasBgSource && (
              <div className="@[560px]:col-span-2">
                <GradientPicker studio={studio} />
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* AUDIO (video only) */}
        {showAudio && (
          <CollapsibleSection
            title="Audio"
            open={sections.audio}
            onToggle={() => toggle('audio')}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 @[560px]:grid-cols-2">
              <div className="@[560px]:col-span-2">
                <UploadField
                  label="Background music"
                  hint="MP3 / WAV · ambient"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/ogg"
                  icon={<VideoIcon />}
                  file={studio.musicFile}
                  onSelect={(f) => studio.setMusicFile(f)}
                  onClear={() => studio.setMusicFile(null)}
                />
              </div>

              {studio.voiceSupportedForLang && (
                <div className="@[560px]:col-span-2">
                  <FieldLabel hint="In-browser AI narration">Voiceover</FieldLabel>
                  <Segmented
                    value={studio.voiceover ? 'on' : 'off'}
                    onChange={(v) => studio.setVoiceover(v === 'on')}
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                    ]}
                  />
                  {studio.voiceover && (
                    <>
                      <div className="mt-3">
                        <Select
                          value={studio.voiceId ?? ''}
                          onChange={studio.setVoice}
                          options={studio.voices.map((v) => ({ value: v.id, label: v.label }))}
                        />
                      </div>
                      {studio.ttsStatus.status === 'loading' && (
                        <p className="mt-2 text-[12px] text-faint">
                          Downloading voice model… {studio.ttsStatus.pct}%
                        </p>
                      )}
                      <p className="mt-2 text-[12px] text-faint">
                        Reads the verse aloud and ducks the music under it. The voice model
                        (~80&nbsp;MB) downloads once, then is cached.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* BRANDING (classic template only) */}
        {showBranding && (
          <CollapsibleSection
            title="Branding"
            open={sections.branding}
            onToggle={() => toggle('branding')}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 @[560px]:grid-cols-2">
              <div>
                <FieldLabel hint="Bottom-left mark">Logo</FieldLabel>
                <Select
                  value={studio.logoStyle}
                  onChange={studio.setLogoStyle}
                  options={[
                    { value: 'icon-only', label: 'App icon' },
                    { value: 'logo-light', label: 'Logo lockup — light' },
                    { value: 'logo-dark', label: 'Logo lockup — dark' },
                  ]}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Sticky footer: format + aspect + generate */}
      <div className="border-t border-line bg-surface px-7 pt-4 pb-5">
        {space === 'social' && (
          <div className="mb-4">
            <div className="mb-2 text-[15px] font-semibold text-ink">Platform</div>
            <Select
              value={studio.platform ?? ''}
              onChange={studio.selectPlatform}
              placeholder="Choose a platform"
              options={SOCIAL_FORMATS.map((f) => ({
                value: f.id,
                label: `${f.label} · ${f.aspect}`,
              }))}
            />
          </div>
        )}
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-4">
          <div className="min-w-[170px] flex-1">
            <div className="mb-2 text-[15px] font-semibold text-ink">Output format</div>
            <Segmented
              value={studio.format}
              onChange={studio.setFormat}
              options={[
                {
                  value: 'video',
                  label: (
                    <>
                      <VideoIcon width={16} height={16} /> Video ad
                    </>
                  ),
                },
                {
                  value: 'image',
                  label: (
                    <>
                      <ImageIcon width={16} height={16} /> Static image
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div className="min-w-[170px] flex-1">
            <div className="mb-2 text-[15px] font-semibold text-ink">Aspect ratio</div>
            <Segmented
              value={studio.aspect}
              onChange={studio.setAspect}
              options={[
                { value: '16:9', label: '16:9' },
                { value: '1:1', label: '1:1' },
                { value: '4:5', label: '4:5' },
                { value: '9:16', label: '9:16' },
              ]}
            />
          </div>
        </div>

        {studio.format === 'image' ? (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[13px] font-semibold text-ink">File type</span>
            <div className="w-[180px]">
              <Segmented
                value={studio.imageFormat}
                onChange={studio.setImageFormat}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'jpg', label: 'JPG' },
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[13px] font-semibold text-ink">Length</span>
            <div className="w-[230px]">
              <Segmented
                value={String(studio.durationSec)}
                onChange={(v) => studio.setDurationSec(Number(v))}
                options={[
                  { value: '6', label: '6s' },
                  { value: '10', label: '10s' },
                  { value: '15', label: '15s' },
                ]}
              />
            </div>
          </div>
        )}

        <p className="mb-2 text-center text-[12px] text-faint">
          Estimated build time: ~{studio.estimateSec}s
          {rendering && ' · renders in the background — keep editing'}
        </p>

        <Button
          variant="primary"
          size="lg"
          onClick={studio.generate}
          disabled={!studio.canGenerate}
          className="w-full"
        >
          {rendering ? (
            <>
              <Spinner className="text-white" /> Queue another {studio.format === 'video' ? 'video' : 'image'}
            </>
          ) : (
            <>
              <Play /> Generate {studio.format === 'video' ? 'video ad' : 'static image'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
