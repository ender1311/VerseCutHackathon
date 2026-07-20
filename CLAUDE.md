# VerseCut — CLAUDE.md

Browser tool for generating Bible-verse marketing assets (image + video ads).
Deployed on Vercel at https://versecut.vercel.app.

## Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # prisma generate + next build
npm run check        # GATE: typecheck + lint (parallel) then tests — run before pushing
npm run check:quick  # typecheck + lint + tests, sequential
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npx prisma db push   # apply schema to the DB (uses DATABASE_URL from .env.local)
```

A husky `pre-push` hook runs `check:quick` — pushes with failing checks are blocked.

## Workflow

Ship via PR, not direct-to-main:
1. Branch, implement, **write tests** for new pure logic (`*.test.ts` next to the source).
2. `npm run check` must pass.
3. Push the branch, open a PR (`gh pr create`).
4. **Read the Greptile review comments** on the PR; address real findings, push fixes.
5. Merge once green + review addressed.

### Self-improvement loop

- After **any** correction from the user, capture the pattern as a durable memory
  (see [Self-learning](#self-learning)) — not a one-off fix.
- Write the lesson as a rule that prevents the *same class* of mistake recurring.
- Review relevant memories at the start of a session before touching the code.

### Verification before done

- Never mark a task complete without proving it works — run tests, check logs,
  exercise the UI. "It should work" is not verification.
- When behavior is in question, diff the change against `main` to confirm the delta
  is intentional and scoped.
- Gut check before presenting: *would a staff engineer approve this?*

### Demand elegance (balanced)

- For non-trivial changes, pause and ask *"is there a more elegant way?"* before
  committing to an approach.
- If a fix feels hacky, redo it properly now that you understand the problem —
  don't ship the workaround.
- Skip this for simple, obvious fixes; don't over-engineer.
- Challenge your own work before presenting it.

### Autonomous bug-fixing

- Given a bug report, just fix it — no hand-holding required. Point at the logs,
  errors, or failing tests, then resolve the root cause.
- Fix failing CI/`npm run check` without being told how.
- Aim for zero context-switching from the user.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 6 + Neon
Postgres · Vercel Blob · WorkOS AuthKit. Client-side Canvas + MediaRecorder for
rendering, ffmpeg.wasm fallback.

## Architecture

```
src/
  app/
    page.tsx            # server: withAuth() → <App userEmail/>
    layout.tsx          # fonts + AuthKitProvider
    login/, callback/, auth/signout/   # WorkOS flow
    api/
      yvp|yvs|yvv|yvb/[...path]/route.ts  # YouVersion proxies (headers/key injected server-side)
      library/, uploads/, blob/upload/   # asset DB + Blob upload token
  middleware.ts         # WorkOS session gate (DISABLE_AUTH bypass in dev only)
  components/           # InputPanel, OutputPanel, VideoLibrary, ImageLibrary, LibraryDrawer, ui
  lib/
    useStudio.ts        # central form + generation state hook
    compositor.ts       # canvas: background → scrim → verse → reference → logo
    render.ts           # image (toBlob) + video (MediaRecorder, audio mix, ffmpeg fallback)
    fonts.ts            # script detection → on-demand Noto font + RTL
    bible/              # swappable providers (internal/platform/api.bible/mock) + types
    videoLibrary.ts     # YouVersion Stories/Videos + seeded manifest
    library.ts          # saved ads + shared image library (client)
    db.ts, server/      # Prisma client, currentUser, proxy helper
```

## Key conventions

- Path alias `@/` → `src/`.
- Server components by default; `'use client'` only for interactivity. The studio
  (`App`) is a client component; `page.tsx` resolves the user server-side.
- API routes return `{ data }` or `{ error }` with correct status codes.
- No `any` — use `unknown` + narrowing. No business logic in components — compute in `lib/`.
- **Bible verse text** comes from the *internal* reader API (`/api/yvb`,
  `youversion-internal` provider): not license-gated, covers the full Bible App
  language list (`src/lib/bible/appLanguages.ts`, sourced from alfred). The
  *Platform* API key is license-scoped and 403s on many languages (e.g. Afrikaans)
  — do not use it for the language picker.
- Config lives in `src/config/index.ts`; secrets are server-only env (never `NEXT_PUBLIC_`).

## Task management

1. **Plan first** — for non-trivial work, write a checkable task list (harness tasks)
   before implementing.
2. **Verify the plan** — check in with the user before starting implementation.
3. **Track progress** — mark items done as you go, not in a batch at the end.
4. **Explain changes** — a high-level summary at each step, not a diff replay.
5. **Document results** — note what changed and what's next when the work lands.
6. **Capture lessons** — after any correction, feed it back into the
   [self-improvement loop](#self-improvement-loop).

## Core principles

- **Simplicity first** — make each change as simple as possible; touch minimal code.
- **No laziness** — find root causes; no temporary patches. Hold to senior-developer
  standards.
- **Minimal impact** — only touch what's necessary; no side effects or new bugs.

## Testing

- New pure function in `lib/` → unit test beside it (`*.test.ts`).
- DOM-dependent tests use `// @vitest-environment jsdom`.
- Run `npm run check` before every push.

## Self-learning

Durable, non-obvious learnings about this project go in the agent memory dir
(`~/.claude/projects/…/memory/`) so they surface in future sessions — e.g. the
Platform-vs-internal API license distinction, and the `.env.local`-overrides-`.env`
gotcha for `NEXT_PUBLIC_*`.

This is also the home for the [self-improvement loop](#self-improvement-loop):
after any correction, save the pattern here as a `feedback`-type memory (rule +
**Why** + **How to apply**) so the same mistake isn't repeated. Prefer updating an
existing memory over adding a near-duplicate.
