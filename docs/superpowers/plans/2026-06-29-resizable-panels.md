# Resizable Panels + Left-Panel Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draggable divider that resizes the studio's two panels, persist the chosen width, reflow the left panel into two columns when wide, and reorganize its controls into collapsible purpose-based groups.

**Architecture:** A pure helper module (`src/lib/panelLayout.ts`) owns width clamping, section-collapse state, and localStorage read/write. `App.tsx` holds the left-panel width in state (CSS variable on the grid) and renders a new `PanelResizer` absolutely on the panel border. `InputPanel` is restructured into `CollapsibleSection` groups whose bodies use Tailwind v4 container queries (`@container` / `@[560px]:`) to reflow to two columns.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (native container queries, no plugin) · Vitest.

## Global Constraints

- No `any` — use `unknown` + narrowing. (CLAUDE.md)
- No business logic in components — pure logic lives in `src/lib/`. (CLAUDE.md)
- New pure function in `lib/` → unit test beside it as `*.test.ts`. (CLAUDE.md)
- Path alias `@/` → `src/`; existing files in `src/` use relative imports — match the file you edit.
- `npm run check` (typecheck + lint + tests) must pass before pushing.
- Width bounds: **MIN 380px, MAX 720px, DEFAULT 460px**.
- Reflow threshold: container width **560px**.
- Default collapse state: **content + background expanded; audio + branding collapsed**.
- localStorage keys: width = `versecut:panelWidth`, sections = `versecut:sections`.
- Tailwind v4 container queries are built in — do NOT add `@tailwindcss/container-queries`.

---

### Task 1: Width helpers (pure) + localStorage wrappers

**Files:**
- Create: `src/lib/panelLayout.ts`
- Test: `src/lib/panelLayout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MIN_PANEL_WIDTH = 380`, `MAX_PANEL_WIDTH = 720`, `DEFAULT_PANEL_WIDTH = 460` (numbers)
  - `clampPanelWidth(px: number): number`
  - `parseStoredWidth(raw: string | null): number | null`
  - `readStoredWidth(): number | null`
  - `writeStoredWidth(px: number): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/panelLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampPanelWidth,
  parseStoredWidth,
  MIN_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
} from './panelLayout';

describe('clampPanelWidth', () => {
  it('returns values within bounds unchanged (rounded)', () => {
    expect(clampPanelWidth(500)).toBe(500);
    expect(clampPanelWidth(460.6)).toBe(461);
  });
  it('clamps below the minimum', () => {
    expect(clampPanelWidth(100)).toBe(MIN_PANEL_WIDTH);
  });
  it('clamps above the maximum', () => {
    expect(clampPanelWidth(9999)).toBe(MAX_PANEL_WIDTH);
  });
  it('falls back to default for non-finite input', () => {
    expect(clampPanelWidth(Number.NaN)).toBe(DEFAULT_PANEL_WIDTH);
    expect(clampPanelWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PANEL_WIDTH);
  });
});

describe('parseStoredWidth', () => {
  it('returns null for missing values', () => {
    expect(parseStoredWidth(null)).toBeNull();
  });
  it('returns null for non-numeric values', () => {
    expect(parseStoredWidth('wide')).toBeNull();
  });
  it('parses and clamps numeric strings', () => {
    expect(parseStoredWidth('500')).toBe(500);
    expect(parseStoredWidth('100')).toBe(MIN_PANEL_WIDTH);
    expect(parseStoredWidth('9999')).toBe(MAX_PANEL_WIDTH);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- panelLayout`
Expected: FAIL — cannot resolve `./panelLayout`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/panelLayout.ts`:

```ts
export const MIN_PANEL_WIDTH = 380;
export const MAX_PANEL_WIDTH = 720;
export const DEFAULT_PANEL_WIDTH = 460;

const WIDTH_KEY = 'versecut:panelWidth';

export function clampPanelWidth(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_PANEL_WIDTH;
  return Math.round(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, px)));
}

export function parseStoredWidth(raw: string | null): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return clampPanelWidth(n);
}

export function readStoredWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredWidth(window.localStorage.getItem(WIDTH_KEY));
  } catch {
    return null;
  }
}

export function writeStoredWidth(px: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WIDTH_KEY, String(clampPanelWidth(px)));
  } catch {
    // localStorage unavailable (private mode / quota) — ignore.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- panelLayout`
Expected: PASS (all `clampPanelWidth` + `parseStoredWidth` cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/panelLayout.ts src/lib/panelLayout.test.ts
git commit -m "Add pure panel-width helpers + localStorage wrappers"
```

---

### Task 2: Section-collapse helpers (pure) + localStorage wrappers

**Files:**
- Modify: `src/lib/panelLayout.ts` (append)
- Test: `src/lib/panelLayout.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type SectionKey = 'content' | 'background' | 'audio' | 'branding'`
  - `type SectionState = Record<SectionKey, boolean>` (true = expanded)
  - `DEFAULT_SECTIONS: SectionState`
  - `resolveSections(stored: Partial<SectionState> | null): SectionState`
  - `toggleSection(state: SectionState, key: SectionKey): SectionState`
  - `parseStoredSections(raw: string | null): SectionState`
  - `readStoredSections(): SectionState`
  - `writeStoredSections(state: SectionState): void`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/panelLayout.test.ts`:

```ts
import {
  DEFAULT_SECTIONS,
  resolveSections,
  toggleSection,
  parseStoredSections,
} from './panelLayout';

describe('resolveSections', () => {
  it('returns defaults for null', () => {
    expect(resolveSections(null)).toEqual(DEFAULT_SECTIONS);
  });
  it('merges partial state over defaults', () => {
    expect(resolveSections({ audio: true })).toEqual({
      ...DEFAULT_SECTIONS,
      audio: true,
    });
  });
});

describe('toggleSection', () => {
  it('flips a single key without mutating the input', () => {
    const start = { ...DEFAULT_SECTIONS };
    const next = toggleSection(start, 'audio');
    expect(next.audio).toBe(!DEFAULT_SECTIONS.audio);
    expect(next.content).toBe(DEFAULT_SECTIONS.content);
    expect(start.audio).toBe(DEFAULT_SECTIONS.audio); // unchanged
  });
});

describe('parseStoredSections', () => {
  it('returns defaults for null', () => {
    expect(parseStoredSections(null)).toEqual(DEFAULT_SECTIONS);
  });
  it('returns defaults for invalid JSON', () => {
    expect(parseStoredSections('{not json')).toEqual(DEFAULT_SECTIONS);
  });
  it('merges valid partial JSON over defaults', () => {
    expect(parseStoredSections('{"branding":true}')).toEqual({
      ...DEFAULT_SECTIONS,
      branding: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- panelLayout`
Expected: FAIL — `resolveSections` / `toggleSection` / `parseStoredSections` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/panelLayout.ts`:

```ts
const SECTIONS_KEY = 'versecut:sections';

export type SectionKey = 'content' | 'background' | 'audio' | 'branding';
export type SectionState = Record<SectionKey, boolean>;

export const DEFAULT_SECTIONS: SectionState = {
  content: true,
  background: true,
  audio: false,
  branding: false,
};

export function resolveSections(stored: Partial<SectionState> | null): SectionState {
  if (!stored) return { ...DEFAULT_SECTIONS };
  return {
    content: stored.content ?? DEFAULT_SECTIONS.content,
    background: stored.background ?? DEFAULT_SECTIONS.background,
    audio: stored.audio ?? DEFAULT_SECTIONS.audio,
    branding: stored.branding ?? DEFAULT_SECTIONS.branding,
  };
}

export function toggleSection(state: SectionState, key: SectionKey): SectionState {
  return { ...state, [key]: !state[key] };
}

export function parseStoredSections(raw: string | null): SectionState {
  if (raw == null) return { ...DEFAULT_SECTIONS };
  try {
    const obj = JSON.parse(raw) as Partial<SectionState> | null;
    return resolveSections(obj);
  } catch {
    return { ...DEFAULT_SECTIONS };
  }
}

export function readStoredSections(): SectionState {
  if (typeof window === 'undefined') return { ...DEFAULT_SECTIONS };
  try {
    return parseStoredSections(window.localStorage.getItem(SECTIONS_KEY));
  } catch {
    return { ...DEFAULT_SECTIONS };
  }
}

export function writeStoredSections(state: SectionState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — ignore.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- panelLayout`
Expected: PASS (width + section suites all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/panelLayout.ts src/lib/panelLayout.test.ts
git commit -m "Add pure section-collapse state helpers + persistence"
```

---

### Task 3: `PanelResizer` component

**Files:**
- Create: `src/components/PanelResizer.tsx`

**Interfaces:**
- Consumes: `clampPanelWidth`, `MIN_PANEL_WIDTH`, `MAX_PANEL_WIDTH` from `../lib/panelLayout`.
- Produces: `PanelResizer({ width, onResize, onCommit }: { width: number; onResize: (w: number) => void; onCommit: (w: number) => void })`.
  - `onResize` fires continuously during drag and on each keyboard nudge (live width).
  - `onCommit` fires once at drag end and after each keyboard nudge (persist point).

- [ ] **Step 1: Create the component**

Create `src/components/PanelResizer.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { clampPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '../lib/panelLayout';

const KEYBOARD_STEP = 16;

export function PanelResizer({
  width,
  onResize,
  onCommit,
}: {
  width: number;
  onResize: (w: number) => void;
  onCommit: (w: number) => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number; latest: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width, latest: width };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = clampPanelWidth(d.startWidth + (e.clientX - d.startX));
    d.latest = next;
    onResize(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit(d.latest);
    drag.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = clampPanelWidth(width - KEYBOARD_STEP);
    else if (e.key === 'ArrowRight') next = clampPanelWidth(width + KEYBOARD_STEP);
    if (next === null) return;
    e.preventDefault();
    onResize(next);
    onCommit(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="absolute top-0 -right-[3px] z-10 hidden h-full w-1.5 cursor-col-resize touch-none lg:block focus-visible:outline-none focus-visible:bg-brand/30 hover:bg-brand/20"
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelResizer.tsx
git commit -m "Add PanelResizer drag/keyboard separator component"
```

---

### Task 4: Wire width state + resizer into `App.tsx`

**Files:**
- Modify: `src/App.tsx` (imports at top; `App` body; the two-panel `<div>` at lines 82–98)

**Interfaces:**
- Consumes: `DEFAULT_PANEL_WIDTH`, `readStoredWidth`, `writeStoredWidth` from `./lib/panelLayout`; `PanelResizer` from `./components/PanelResizer`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add imports**

In `src/App.tsx`, after line 3 (`import { useState } from 'react';`) change to include `useEffect`, and add the two new imports near the other component/lib imports:

```tsx
import { useEffect, useState } from 'react';
```

Add alongside the existing imports (e.g. after line 9):

```tsx
import { PanelResizer } from './components/PanelResizer';
import {
  DEFAULT_PANEL_WIDTH,
  readStoredWidth,
  writeStoredWidth,
} from './lib/panelLayout';
```

- [ ] **Step 2: Add width state + hydration-safe load**

In the `App` component body, after the existing `const [rightView, setRightView] = useState<RightView>('output');` line, add:

```tsx
  // Start at the deterministic default so SSR and first client render match,
  // then adopt any stored width after mount.
  const [leftWidth, setLeftWidth] = useState(DEFAULT_PANEL_WIDTH);
  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) setLeftWidth(stored);
  }, []);
```

- [ ] **Step 3: Replace the two-panel layout block**

Replace the block currently at `src/App.tsx:82-98`:

```tsx
      {/* Two-panel body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(420px,468px)_1fr]">
        <aside className="min-h-0 border-r border-line bg-surface">
          <InputPanel
            studio={studio}
            space={space}
            onBrowse={(v) => setRightView(v)}
          />
        </aside>
        <main className="min-h-0 bg-panel">
          <RightPanel
            studio={studio}
            space={space}
            view={rightView}
            setView={setRightView}
          />
        </main>
      </div>
```

with:

```tsx
      {/* Two-panel body */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--left-col)_1fr]"
        style={{ '--left-col': `${leftWidth}px` } as React.CSSProperties}
      >
        <aside className="relative min-h-0 border-r border-line bg-surface">
          <InputPanel
            studio={studio}
            space={space}
            onBrowse={(v) => setRightView(v)}
          />
          <PanelResizer
            width={leftWidth}
            onResize={setLeftWidth}
            onCommit={writeStoredWidth}
          />
        </aside>
        <main className="min-h-0 bg-panel">
          <RightPanel
            studio={studio}
            space={space}
            view={rightView}
            setView={setRightView}
          />
        </main>
      </div>
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open http://localhost:3000.
Expected: a vertical grab handle on the right edge of the left panel; dragging it resizes both panels; width stops at ~380px / ~720px; reload preserves the width; focusing the handle and pressing Left/Right arrows nudges it.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "Wire resizable left-panel width with persistence into App"
```

---

### Task 5: `CollapsibleSection` UI primitive

**Files:**
- Modify: `src/components/ui.tsx` (add export; uses existing `ChevronDown` import on line 2)

**Interfaces:**
- Consumes: `ChevronDown` (already imported in `ui.tsx` line 2).
- Produces: `CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode })`.

- [ ] **Step 1: Add the component**

Append to `src/components/ui.tsx` (after `SectionHeader`, which ends at line 79). It reuses the `SectionHeader` visual treatment but makes the header a toggle button:

```tsx
export function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mb-5 mt-1 flex w-full items-center gap-3"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {title}
        </span>
        <span className="h-px flex-1 bg-line" />
        <ChevronDown className={`text-faint transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mb-6">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`ReactNode` is already imported in `ui.tsx` line 1.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui.tsx
git commit -m "Add CollapsibleSection UI primitive"
```

---

### Task 6: Reorganize `InputPanel` into collapsible groups with 2-column reflow

**Files:**
- Modify: `src/components/InputPanel.tsx` (imports lines 1–6; the scroll-area block lines 142–364)

**Interfaces:**
- Consumes: `CollapsibleSection` from `./ui`; `useEffect`/`useState` from `react`; `readStoredSections`, `writeStoredSections`, `toggleSection`, `DEFAULT_SECTIONS`, `type SectionKey`, `type SectionState` from `../lib/panelLayout`.
- Produces: nothing for later tasks (terminal UI task).

The sticky footer (lines 366–476) is **unchanged**. Only the imports and the scrollable area change.

- [ ] **Step 1: Update imports**

In `src/components/InputPanel.tsx`, change line 1:

```tsx
import { useEffect, useState } from 'react';
```

Change line 5 to add `CollapsibleSection` (drop the now-unused `SectionHeader`):

```tsx
import { Button, CollapsibleSection, FieldLabel, Segmented, Select, Stepper, UploadField } from './ui';
```

Add after line 6 (`import { SOCIAL_FORMATS } ...`):

```tsx
import {
  DEFAULT_SECTIONS,
  readStoredSections,
  toggleSection,
  writeStoredSections,
  type SectionKey,
  type SectionState,
} from '../lib/panelLayout';
```

- [ ] **Step 2: Add collapse state inside `InputPanel`**

In the `InputPanel` function body, after the existing `const hasBgSource = ...` line (line 137–138), add:

```tsx
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
```

- [ ] **Step 3: Replace the scroll-area body**

Replace the block currently at `src/components/InputPanel.tsx:142-364` (the `<div className="scroll-slim ...">` and everything inside it up to and including its closing `</div>` right before the sticky footer comment) with:

```tsx
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
                  className="h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-[15px] font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
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
              <FieldLabel hint="Reusable backgrounds">Image library</FieldLabel>
              {sharedImg && (
                <SelectedChip
                  icon={<ImageIcon />}
                  title={sharedImg.label}
                  subtitle="Shared background"
                  onClear={studio.clearSharedBg}
                />
              )}
              <BrowseEntry
                icon={<ImageIcon />}
                title="Browse the image library"
                hint="Reusable team backgrounds · upload new"
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
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. If lint flags `SectionHeader` as unused anywhere else, confirm it's no longer imported in this file (it isn't after Step 1); `SectionHeader`'s export in `ui.tsx` stays (it may be used elsewhere — do not delete it).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`.
Expected:
- Left panel shows Content / Background groups expanded, Audio (video format) / Branding (classic template) collapsed.
- Clicking a group header collapses/expands it; chevron rotates; reload preserves collapse state.
- Switching Output format to Static image hides the Audio group; switching Template to App promo hides Branding and reveals Call to action under Content.
- Dragging the divider wider past ~560px panel width reflows each group's fields into two columns; Verse range, Call to action, and Background gradient span full width.

- [ ] **Step 6: Commit**

```bash
git add src/components/InputPanel.tsx
git commit -m "Reorganize InputPanel into collapsible groups with 2-column reflow"
```

---

### Task 7: Full gate + branch push

**Files:** none (verification + delivery)

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: typecheck + lint + tests all PASS.

- [ ] **Step 2: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "Resizable panels + reorganized left panel" --body "$(cat <<'EOF'
## Summary
- Draggable divider between the input and preview panels (width persisted to localStorage, 380–720px).
- Left panel reflows to two columns past ~560px via Tailwind container queries.
- Left panel reorganized into collapsible Content / Background / Audio / Branding groups (collapse state persisted).

## Test plan
- [ ] Drag divider; width clamps at 380/720 and survives reload.
- [ ] Keyboard: focus handle, Left/Right arrows nudge width.
- [ ] Widen panel past ~560px → fields reflow to 2 columns.
- [ ] Collapse/expand groups; state survives reload.
- [ ] Static image format hides Audio; promo template hides Branding + shows CTA.
EOF
)"
```

- [ ] **Step 3: Address Greptile review**

Per CLAUDE.md: read the Greptile review comments on the PR, address real findings, push fixes, merge once green.

---

## Self-Review

**Spec coverage:**
- Draggable divider → Task 3 (component) + Task 4 (wiring). ✓
- Resizes both panels at once → Task 4 grid CSS var. ✓
- Width persistence → Task 1 (helpers) + Task 4 (load/commit). ✓
- Width bounds 380–720, default 460 → Task 1 constants. ✓
- Reflow to 2 columns at ~560px (container queries) → Task 6 `@container` + `@[560px]:`. ✓
- Hidden resizer / single column on mobile → Task 3 (`hidden lg:block`) + Task 4 (`grid-cols-1 lg:...`). ✓
- Grouped + collapsible sections (Content/Background/Audio/Branding) → Task 5 (primitive) + Task 6 (usage). ✓
- Group defaults + conditional rendering preserved → Task 2 `DEFAULT_SECTIONS` + Task 6 `showAudio`/`showBranding` and inline conditions. ✓
- Collapse-state persistence → Task 2 + Task 6. ✓
- Pinned footer unchanged → Task 6 leaves lines 366–476 intact. ✓
- Unit tests for pure logic → Tasks 1 & 2. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step has complete code. ✓

**Type consistency:** `clampPanelWidth`, `readStoredWidth`, `writeStoredWidth`, `readStoredSections`, `writeStoredSections`, `toggleSection`, `DEFAULT_SECTIONS`, `SectionKey`, `SectionState` names match between definition (Tasks 1–2) and consumers (Tasks 4, 6). `PanelResizer` props (`width`/`onResize`/`onCommit`) match between Task 3 and Task 4. `CollapsibleSection` props (`title`/`open`/`onToggle`/`children`) match between Task 5 and Task 6. ✓
