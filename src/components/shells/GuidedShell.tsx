'use client';

import { useState } from 'react';
import type { ShellProps } from './index';
import { Check, ChevronDown } from '../icons';
import { Button } from '../ui';
import { PreviewCard } from '../studio/PreviewCard';
import { OutputPanel } from '../OutputPanel';
import {
  AudioFields,
  BackgroundFields,
  BrandingFields,
  GenerateFooter,
  OutputFields,
  VerseFields,
  showAudioFields,
  showBrandingFields,
} from '../studio/controls';

const STEPS = [
  { key: 'verse', label: 'Verse' },
  { key: 'background', label: 'Background' },
  { key: 'format', label: 'Format' },
  { key: 'export', label: 'Export' },
] as const;

function Spine({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-0 border-b border-line bg-surface px-8 py-4">
      {STEPS.map((s, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'upcoming';
        return (
          <div key={s.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={i > step}
              className="flex items-center gap-2.5 disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${
                  state === 'done'
                    ? 'bg-brand text-white'
                    : state === 'active'
                      ? 'bg-brand/10 text-brand ring-2 ring-brand/40'
                      : 'bg-line-soft text-faint'
                }`}
              >
                {state === 'done' ? <Check /> : i + 1}
              </span>
              <span
                className={`text-[14px] font-semibold ${
                  state === 'upcoming' ? 'text-faint' : 'text-ink'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className={`mx-4 h-px w-12 ${i < step ? 'bg-brand/40' : 'bg-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const KICKER: Record<number, { title: React.ReactNode; sub: string }> = {
  0: {
    title: (
      <>
        Which <span className="text-brand">verse</span>?
      </>
    ),
    sub: 'Pick the passage and translation. The preview updates as you go.',
  },
  1: {
    title: (
      <>
        Set the <span className="text-brand">scene</span>
      </>
    ),
    sub: 'Choose a background — browse the library, upload your own, or use a gradient.',
  },
  2: {
    title: (
      <>
        How should it <span className="text-brand">run</span>?
      </>
    ),
    sub: 'Pick the format, aspect ratio, and length. You can change it later.',
  },
  3: {
    title: (
      <>
        Ready to <span className="text-brand">export</span>
      </>
    ),
    sub: 'Generate the asset — it renders right here in your browser.',
  },
};

export function GuidedShell({ studio, space, settings, onBrowse }: ShellProps) {
  const [step, setStep] = useState(0);
  const last = STEPS.length - 1;
  const kicker = KICKER[step];

  return (
    <div className="flex h-full flex-col">
      <Spine step={step} onJump={setStep} />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_452px]">
        <div className="scroll-slim min-h-0 overflow-y-auto px-11 py-8">
          <h2 className="text-[26px] font-extrabold tracking-tight text-ink">{kicker.title}</h2>
          <p className="mb-7 mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted">{kicker.sub}</p>

          {step === 0 && <VerseFields studio={studio} />}

          {step === 1 && (
            <div className="flex flex-col gap-7">
              <BackgroundFields studio={studio} onBrowse={onBrowse} />
              {showBrandingFields(studio, settings) && <BrandingFields studio={studio} />}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-7">
              <OutputFields studio={studio} space={space} />
              {showAudioFields(studio, settings) && <AudioFields studio={studio} settings={settings} />}
            </div>
          )}

          {step === 3 && (
            <div className="flex min-h-0 flex-col gap-5">
              <GenerateFooter studio={studio} />
              <div className="min-h-[420px] flex-1 rounded-2xl border border-line">
                <OutputPanel studio={studio} space={space} />
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronDown className="rotate-90" /> Back
            </Button>
            {step < last && (
              <Button variant="primary" onClick={() => setStep((s) => Math.min(last, s + 1))}>
                Continue to {STEPS[step + 1].label} <ChevronDown className="-rotate-90" />
              </Button>
            )}
          </div>
        </div>

        {/* Live preview aside */}
        <aside className="flex min-h-0 flex-col items-center justify-center gap-3 border-l border-line bg-panel p-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">
            Live preview
          </span>
          <PreviewCard studio={studio} className="w-full flex-1" capPx={620} />
          <span className="text-[12.5px] text-muted">Building as you go</span>
        </aside>
      </div>
    </div>
  );
}
