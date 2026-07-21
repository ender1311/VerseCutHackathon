# Four switchable UI shells — design

## Goal

Offer four distinct studio layouts ("directions") over the same generation
engine, switchable from Settings. Guided Path is the default.

Directions (from the mockup `VerseCut — 4 Directions`):

1. **Everlight** — calm editorial: one big preview + a quiet numbered inspector.
2. **Everdark Studio** — dark pro editor: tool rail + contextual panel + stage +
   honest bottom progress strip.
3. **Guided Path** *(default)* — a numbered step spine, one decision on screen at
   a time, live preview aside.
4. **Templates-first** — start from a ready-made template, then tweak in an aside.

## Core principle

All four are **layout shells** over the identical `useStudio()` state. Nothing
about generation, rendering, verse-fetching, or libraries changes. The design
decomposes today's monolithic `InputPanel` into reusable **control groups**,
then composes them four ways.

## Scope decisions (confirmed with user)

- **Desktop-only switching.** Shells apply at `≥lg`. `<lg` keeps today's tabbed
  flow (Edit/Preview/Library) verbatim — it is already a guided one-view flow.
- **Match each direction's character.** Everdark gets a real dark theme (mockup
  hexes), Templates gets the cream/editorial look, etc.
- **Functional-lite.** Templates set real studio state via presets. Everdark's
  "timeline" is an honest duration + render-progress strip, not a frame editor
  (the one-shot canvas render pipeline can't support scrubbing).

## Guardrails (out of scope)

- No live DOM verse overlay on the draft preview — that would duplicate the
  canvas compositor and drift from real output. Previews show the live
  background, then the real composited render after Generate (same as today).
- No mobile shell variants.
- No real timeline scrubber.

## Work

### 1. Refactor: extract control groups (no behavior change)

`src/components/studio/controls.tsx` — pull inline blocks out of `InputPanel`:
`VerseFields`, `BackgroundFields` (+ `GradientPicker`, `SelectedChip`,
`BrowseEntry`, `UnsplashCredit`), `AudioFields`, `BrandingFields`, `OutputFields`,
`GenerateFooter`. `InputPanel` becomes a thin composition inside its existing
`CollapsibleSection`s — mobile + fallback UX unchanged.

`src/components/studio/PreviewCard.tsx` — extract `PreviewFrame` + a compact
`PreviewCard` (reuses `resolveDraftBackground`) for the aside previews in
Guided/Templates. The big stage reuses `<OutputPanel>` as-is.

### 2. Settings plumbing

`appSettings.ts`: add `uiMode: UiMode` (`'guided' | 'everlight' | 'everdark' |
'templates'`), **default `'guided'`**, sanitized (unknown → `'guided'`) through
`resolveAppSettings`/parse. Add `UI_MODE_META` (id, name, tagline).
`SettingsDrawer` gets an "Interface" section (4 selectable cards). `App` plumbs
`setUiMode` like `verseDefault`.

### 3. Shells (`src/components/shells/`)

`App` at `≥lg` renders `<Shell mode>`; `<lg` unchanged. Global header stays and
becomes theme-aware (dark only for Everdark). Each shell owns its contextual
chrome below.

- `GuidedShell` — top step spine (Verse→Background→Format→Export), one control
  group at a time with Back/Continue, `PreviewCard` aside. Local `step` state.
- `EverlightShell` — `<OutputPanel>` stage left, numbered inspector right built
  from control groups, `GenerateFooter` bottom.
- `EverdarkShell` — dark theme, left icon tool-rail selecting the visible control
  group, `<OutputPanel>` stage, honest duration/progress strip.
- `TemplatesShell` — masthead + template gallery; picking a card calls
  `applyTemplate` and opens an aside with quick edits + Generate.

`shells/index.tsx` maps `UiMode → component` and defines shared chrome types.

### 4. Templates data (`src/lib/templates.ts`)

~7 presets `{ id, name, badge, aspect, format, gradientId, template, cta? }` +
pure `applyTemplate(studio, tpl)`. Unit-tested.

## Testing

- Extend `appSettings.test.ts`: `uiMode` default + invalid → `guided`.
- New `templates.test.ts`: `applyTemplate` sets expected studio fields.
- `npm run check` green; manually exercise all 4 modes + switching in-browser.

## Files

New: `studio/controls.tsx`, `studio/PreviewCard.tsx`,
`shells/{index,GuidedShell,EverlightShell,EverdarkShell,TemplatesShell}.tsx`,
`lib/templates.ts` (+`templates.test.ts`).
Edited: `appSettings.ts` (+test), `SettingsDrawer.tsx`, `App.tsx`, `InputPanel.tsx`.
