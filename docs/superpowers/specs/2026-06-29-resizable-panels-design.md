# Resizable Panels + Left-Panel Reorganization — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)

## Problem

The studio is a fixed two-column layout: a left input panel hardcoded at
`minmax(420px,468px)` and a right preview panel taking the rest (`App.tsx:82`).
Two issues:

1. The user cannot adjust how much horizontal space each panel gets.
2. The left `InputPanel` dumps ~11 controls into a flat "Optional" block, which
   is hard to scan and doesn't use extra width well.

## Goals

- A draggable divider between the two panels that resizes both at once (left
  panel grows/shrinks, right panel takes the remainder).
- The left panel's contents reflow into two columns when it's wide enough.
- The chosen width persists across reloads.
- The left panel is reorganized into purpose-based, collapsible groups.

## Non-goals

- No change to the right panel's internal content (Preview / Video library /
  Image library tabs stay as-is).
- No mobile resizer — below the `lg` breakpoint the layout stays single-column
  and stacked.
- No change to generation/render behavior; this is layout/organization only.

## Design

### 1. Draggable divider — `PanelResizer.tsx`

A new component rendered between `<aside>` and `<main>` in `App.tsx`. It is a
thin (6px) interactive hit-zone with `cursor-col-resize`, visually aligned with
the existing `border-line` divider.

- **Pointer drag:** `pointerdown` calls `setPointerCapture`; `pointermove`
  translates `clientX` delta into a new left width; `pointerup` releases capture
  and persists the final width.
- **Keyboard:** `role="separator"`, `aria-orientation="vertical"`,
  `aria-valuemin/max/now`. ArrowLeft/ArrowRight nudge the width ±16px.
- **Responsive:** the resizer is hidden below the `lg` breakpoint (`hidden lg:block`),
  matching the layout's single-column collapse on mobile.

### 2. Width state + persistence

- `App.tsx` replaces the static Tailwind grid columns with an inline style:
  `style={{ gridTemplateColumns: \`${leftWidth}px 1fr\` }}` on the grid container
  (the `lg`-and-up two-column layout). Below `lg`, the grid remains
  `grid-cols-1` and the inline override is not applied.
- `leftWidth` is React state in `App.tsx`, **clamped to [380, 720] px**, default **460**.
- Initialized from `localStorage["versecut:panelWidth"]` (parsed + clamped;
  falls back to default on missing/invalid).
- Written back to localStorage on drag-end and on keyboard nudge.

**Pure helpers (unit-tested):**
- `clampPanelWidth(px, min, max)` → clamped integer.
- `readStoredWidth()` / `writeStoredWidth(px)` — parse/guard localStorage value.

These live in a small module (e.g. `src/lib/panelLayout.ts`) with
`panelLayout.test.ts` beside it.

### 3. Reflow to two columns (container queries)

Tailwind v4 container queries drive the reflow off the **panel's own width**, not
the viewport — correct behavior for a resizable panel.

- The `InputPanel` scroll area is marked `@container`.
- Each group's controls sit in a grid: `grid grid-cols-1 @[560px]:grid-cols-2`
  with a sensible gap.
- Controls that should never split across columns (background gradient picker,
  call-to-action text input, and the verse-range stepper row) get
  `@[560px]:col-span-2`.
- The pinned footer (output format / aspect / length / generate) keeps its
  current flex layout; it already adapts and stays full-width.

### 4. Reorganization — grouped + collapsible

The "Required/Optional" framing is replaced by purpose-based groups. A new
`CollapsibleSection` component provides a chevron header (reusing `SectionHeader`
styling) and toggles an expanded/collapsed body.

| Group | Controls | Default |
|---|---|---|
| **Content** | Language, Verse range, Bible version, Template, Call to action *(promo template only)* | expanded |
| **Background** | Background image, Background video, Video library, Image library, Background gradient | expanded |
| **Audio** *(video format only)* | Background music, Voiceover | collapsed |
| **Branding** | Logo *(classic template only)* | collapsed |
| *pinned footer (unchanged)* | Output format, Aspect ratio, Length, Generate | always visible |

- Existing conditional-rendering rules are preserved (e.g. Audio group only
  appears for the video output format; Logo only for the classic template; CTA
  only for the promo template). A group with no visible controls is not rendered.
- Collapse state persists to `localStorage["versecut:sections"]` (a map of
  group key → boolean). Defaults applied when a key is absent.
- The collapse-state reducer (`toggleSection`, default-merge) is pure →
  unit-tested.

## Data flow

```
App.tsx
  ├─ leftWidth state ──(inline gridTemplateColumns)──> grid container
  ├─ <aside><InputPanel/></aside>
  ├─ <PanelResizer onResize={setLeftWidth} onCommit={persist} .../>   (lg only)
  └─ <main><RightPanel/></main>

InputPanel (@container)
  └─ <CollapsibleSection> × N  ─ each body is a @[560px]:grid-cols-2 grid
```

## Testing

Per CLAUDE.md, new pure logic gets a `*.test.ts` beside the source:

- `panelLayout.test.ts` — `clampPanelWidth` bounds/rounding;
  `readStoredWidth` parsing of missing / non-numeric / out-of-range values.
- collapse-state reducer test — toggle, default merge for absent keys.

DOM-dependent drag behavior is covered manually (drag the divider, reload to
confirm persistence, narrow/widen to confirm reflow) since `MediaRecorder`-style
DOM interaction isn't unit-tested in this repo.

`npm run check` must pass before pushing.

## Decisions (confirmed)

- Width bounds **380–720px**, default **460**.
- Reflow threshold **~560px** (container query).
- **Audio** and **Branding** collapsed by default; **Content** and **Background** expanded.
- Width and collapse state both persisted to localStorage (first UI-preference
  persistence in the app).
