import type { useStudio } from '../lib/useStudio';
import { ImageIcon, Play, Spinner, VideoIcon } from './icons';
import { FieldLabel, Segmented, SectionHeader, Select, Stepper, UploadField } from './ui';
import { VideoLibrary } from './VideoLibrary';

type Studio = ReturnType<typeof useStudio>;

export function InputPanel({ studio }: { studio: Studio }) {
  const running = studio.phase === 'running';

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-slim flex-1 overflow-y-auto px-7 pt-6 pb-4">
        {/* REQUIRED */}
        <SectionHeader label="Required" tone="required" />

        <div className="mb-6">
          <FieldLabel required>Language</FieldLabel>
          <Select
            value={studio.languageId}
            onChange={studio.setLanguageId}
            placeholder="Select a language"
            options={studio.languages.map((l) => ({ value: l.id, label: l.name }))}
          />
        </div>

        <div className="mb-6">
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

        {/* OPTIONAL */}
        <SectionHeader label="Optional" tone="optional" />

        <div className="mb-6">
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

        <div className="mb-6">
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

        <div className="mb-6">
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

        <div className="mb-6">
          <UploadField
            label="Background video"
            hint="MP4 / MOV"
            accept="video/mp4,video/quicktime"
            icon={<VideoIcon />}
            file={studio.videoFile}
            onSelect={(f) => studio.setVideoFile(f)}
            onClear={() => studio.setVideoFile(null)}
          />
        </div>

        <div className="mb-2">
          <VideoLibrary studio={studio} />
        </div>
      </div>

      {/* Sticky footer: format + aspect + generate */}
      <div className="border-t border-line bg-surface px-7 pt-4 pb-5">
        <div className="mb-4 flex gap-6">
          <div className="flex-1">
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
          <div className="w-[210px]">
            <div className="mb-2 text-[15px] font-semibold text-ink">Aspect ratio</div>
            <Segmented
              value={studio.aspect}
              onChange={studio.setAspect}
              options={[
                { value: '16:9', label: '16:9' },
                { value: '1:1', label: '1:1' },
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

        <button
          type="button"
          onClick={studio.generate}
          disabled={!studio.canGenerate}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[16px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(254,55,69,0.6)] transition hover:bg-brand-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-faint disabled:shadow-none"
        >
          {running ? (
            <>
              <Spinner className="text-white" /> Generating…
            </>
          ) : (
            <>
              <Play /> Generate {studio.format === 'video' ? 'video ad' : 'static image'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
