'use client';

import { useState } from 'react';
import type { useStudio } from '../../lib/useStudio';
import type { LibraryView } from '../../lib/libraryView';
import { ChevronDown, ImageIcon, Play, Spinner, UploadCloud, VideoIcon, XMark } from '../icons';
import { Button, FieldLabel, SearchableSelect, Segmented, Select, Stepper, UploadField } from '../ui';
import { SOCIAL_FORMATS } from '../../lib/socialFormats';
import { gradientFromHex, normalizeHex } from '../../lib/gradients';
import type { AppSettings } from '../../lib/appSettings';
import { deriveSource } from '../../lib/assetTaxonomy';

type Studio = ReturnType<typeof useStudio>;

// ── Shared predicates (so shells can decide whether to surface a group) ──

export function showAudioFields(studio: Studio, settings: AppSettings): boolean {
  return studio.format === 'video' && (settings.music || settings.voiceover);
}

export function showBrandingFields(studio: Studio, settings: AppSettings): boolean {
  return studio.template === 'classic' && settings.branding;
}

export function outputSummary(studio: Studio): string {
  return `${studio.format === 'video' ? 'Video' : 'Image'} · ${studio.aspect} · ${
    studio.format === 'video' ? `${studio.durationSec}s` : studio.imageFormat.toUpperCase()
  }`;
}

// ── Small building blocks ──

export function BrowseEntry({
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

export function SelectedChip({
  icon,
  title,
  subtitle,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
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

/** Unsplash API guideline: credit the photographer + Unsplash with links. */
export function UnsplashCredit({
  photographerName,
  photographerUrl,
  photoUrl,
}: {
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
}) {
  const utm = (url: string) => {
    try {
      const u = new URL(url);
      u.searchParams.set('utm_source', 'versecut');
      u.searchParams.set('utm_medium', 'referral');
      return u.toString();
    } catch {
      return url;
    }
  };
  const linkClass = 'font-medium text-ink underline-offset-2 hover:underline';
  return (
    <span>
      Photo by{' '}
      <a href={utm(photographerUrl)} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {photographerName}
      </a>{' '}
      on{' '}
      <a
        href={utm('https://unsplash.com')}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        title={photoUrl}
      >
        Unsplash
      </a>
    </span>
  );
}

export function GradientPicker({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  // Draft for the hex text field so the user can type freely; null = mirror the
  // committed custom color (reflects the color picker / Clear).
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const isCustom = !!studio.customColor;
  const customPreset = studio.customColor ? gradientFromHex(studio.customColor) : null;
  const current =
    customPreset ?? studio.gradients.find((g) => g.id === studio.gradientId) ?? studio.gradients[0];
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
          <span className="block text-[14px] font-semibold text-ink">Background gradient</span>
          <span className="block text-[12px] text-faint">
            {isCustom ? `Custom · ${studio.customColor}` : current.name}
          </span>
        </span>
        <ChevronDown className={`text-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="mt-3 grid grid-cols-8 gap-2">
            {studio.gradients.map((g) => {
              const selected = !isCustom && studio.gradientId === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  title={g.name}
                  aria-label={g.name}
                  aria-pressed={selected}
                  onClick={() => studio.setGradientId(g.id)}
                  className={`aspect-square rounded-lg border transition ${
                    selected ? 'border-brand ring-2 ring-brand/40' : 'border-line hover:border-faint'
                  }`}
                  style={{ backgroundImage: swatch(g) }}
                />
              );
            })}
          </div>
          <div
            className={`mt-3 flex items-center gap-3 rounded-xl border p-3 ${
              isCustom ? 'border-brand ring-2 ring-brand/30' : 'border-line'
            }`}
          >
            <input
              type="color"
              aria-label="Custom background color"
              value={studio.customColor ?? '#1e40af'}
              onChange={(e) => studio.setCustomColor(normalizeHex(e.target.value))}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Custom color</div>
              <input
                type="text"
                spellCheck={false}
                placeholder="#1e40af"
                value={hexDraft ?? studio.customColor ?? ''}
                onChange={(e) => {
                  setHexDraft(e.target.value);
                  const hex = normalizeHex(e.target.value);
                  if (hex) studio.setCustomColor(hex);
                }}
                onBlur={() => setHexDraft(null)}
                className="mt-0.5 w-28 rounded-md border border-line bg-surface px-2 py-1 text-[13px] font-medium text-ink outline-none focus:border-brand"
              />
            </div>
            {isCustom && (
              <button
                type="button"
                onClick={() => studio.setGradientId(studio.gradientId)}
                className="text-[12px] font-semibold text-faint transition hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Control groups (each is its own @container so it lays out 1- or 2-col
//    based on the width it's dropped into) ──

export function VerseFields({ studio }: { studio: Studio }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 @[520px]:grid-cols-2">
        {studio.catalogError && (
          <p className="text-[13px] font-medium text-brand @[520px]:col-span-2">
            {studio.catalogError}
          </p>
        )}
        <div>
          <FieldLabel required>Language</FieldLabel>
          <SearchableSelect
            value={studio.languageId}
            onChange={studio.setLanguageId}
            placeholder="Select a language"
            searchPlaceholder="Search languages…"
            options={studio.languages.map((l) => ({ value: l.id, label: l.name, group: l.group }))}
          />
        </div>

        <div className="@[520px]:col-span-2">
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
          <SearchableSelect
            value={studio.versionId}
            onChange={studio.setVersionId}
            disabled={studio.versions.length === 0}
            placeholder="Select a version"
            searchPlaceholder="Search versions…"
            options={studio.versions.map((v) => ({
              value: v.id,
              label: `${v.abbreviation} — ${v.name}`,
            }))}
          />
        </div>

        {studio.template === 'promo' && (
          <div className="@[520px]:col-span-2">
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
    </div>
  );
}

/** Unified summary of the active background source (upload or library pick), or
 * null when the gradient is the background. */
function currentBackground(studio: Studio) {
  const sharedSourceLabel = (label: string, kind: 'image' | 'video') => {
    const src = deriveSource(label);
    if (src === 'youversion') return 'YouVersion background';
    if (src === 'unsplash') return 'Unsplash background';
    return kind === 'video' ? 'Video background' : 'Image background';
  };
  if (studio.imageFile) {
    return {
      icon: <ImageIcon />,
      title: studio.imageFile.name,
      subtitle: 'Uploaded image' as React.ReactNode,
      clear: () => studio.setImageFile(null),
    };
  }
  if (studio.videoFile) {
    return {
      icon: <VideoIcon />,
      title: studio.videoFile.name,
      subtitle: 'Uploaded video' as React.ReactNode,
      clear: () => studio.setVideoFile(null),
    };
  }
  if (studio.sharedBg) {
    return {
      icon: studio.sharedBg.kind === 'video' ? <VideoIcon /> : <ImageIcon />,
      title: studio.sharedBg.label,
      subtitle: studio.sharedBg.attribution ? (
        <UnsplashCredit {...studio.sharedBg.attribution} />
      ) : (
        sharedSourceLabel(studio.sharedBg.label, studio.sharedBg.kind)
      ),
      clear: studio.clearSharedBg,
    };
  }
  return null;
}

export function BackgroundFields({
  studio,
  onBrowse,
}: {
  studio: Studio;
  onBrowse: (view: LibraryView) => void;
}) {
  const hasBgSource = !!studio.imageFile || !!studio.videoFile || !!studio.sharedBg;
  const currentBg = currentBackground(studio);

  return (
    <div className="flex flex-col gap-3">
      {currentBg && (
        <SelectedChip
          icon={currentBg.icon}
          title={currentBg.title}
          subtitle={currentBg.subtitle}
          onClear={currentBg.clear}
        />
      )}

      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @[420px]:grid-cols-2">
          <BrowseEntry
            icon={<ImageIcon />}
            title="Browse library"
            hint="YouVersion · Unsplash · Videos"
            onClick={() => onBrowse('youversion')}
          />
          <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-faint">
            <input
              type="file"
              accept="image/png,image/jpeg,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.type.startsWith('video')) studio.setVideoFile(f);
                  else studio.setImageFile(f);
                }
                e.target.value = '';
              }}
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
              <UploadCloud />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">Upload</span>
              <span className="block text-[12px] text-faint">Image or video</span>
            </span>
          </label>
        </div>
      </div>

      {/* Gradient — the default background when no image/video is set */}
      {!hasBgSource && <GradientPicker studio={studio} />}
    </div>
  );
}

export function AudioFields({ studio, settings }: { studio: Studio; settings: AppSettings }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6">
        {settings.music && (
          <UploadField
            label="Background music"
            hint="MP3 / WAV · ambient"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/ogg"
            icon={<VideoIcon />}
            file={studio.musicFile}
            onSelect={(f) => studio.setMusicFile(f)}
            onClear={() => studio.setMusicFile(null)}
          />
        )}

        {settings.voiceover && studio.voiceSupportedForLang && (
          <div>
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
                  Reads the verse aloud and ducks the music under it. The voice model downloads
                  once (larger on GPU-accelerated browsers), then is cached.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function BrandingFields({ studio }: { studio: Studio }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6">
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
    </div>
  );
}

export function OutputFields({
  studio,
  space = 'ads',
}: {
  studio: Studio;
  space?: 'ads' | 'social';
}) {
  return (
    <div>
      {space === 'social' && (
        <div className="mb-4">
          <div className="mb-2 text-[15px] font-semibold text-ink">Platform</div>
          <Select
            value={studio.platform ?? ''}
            onChange={studio.selectPlatform}
            placeholder="Choose a platform"
            options={SOCIAL_FORMATS.map((f) => ({ value: f.id, label: `${f.label} · ${f.aspect}` }))}
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
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
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
    </div>
  );
}

export function GenerateFooter({
  studio,
  onGenerate,
  className = '',
}: {
  studio: Studio;
  onGenerate?: () => void;
  className?: string;
}) {
  const rendering = studio.isRendering;
  return (
    <div className={className}>
      <p className="mb-2 text-center text-[12px] text-faint">
        Estimated build time: ~{studio.estimateSec}s
        {rendering && ' · renders in the background — keep editing'}
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={onGenerate ?? studio.generate}
        disabled={!studio.canGenerate}
        className="w-full md:h-14 md:px-6 md:text-[16px]"
      >
        {rendering ? (
          <>
            <Spinner className="text-white" /> Queue another{' '}
            {studio.format === 'video' ? 'video' : 'image'}
          </>
        ) : (
          <>
            <Play /> Generate {studio.format === 'video' ? 'video ad' : 'static image'}
          </>
        )}
      </Button>
      {studio.generateBlockedReason && (
        <p className="mt-2 text-center text-[12px] font-medium text-muted">
          {studio.generateBlockedReason}
        </p>
      )}
    </div>
  );
}
