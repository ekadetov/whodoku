# Whodoku MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the Whodoku daily murder-mystery logic puzzle as an installable PWA on GitHub Pages.

**Architecture:** Pure TypeScript engine (seeded generator plus uniqueness solver) under
`src/engine/`, a reducer-based state layer with versioned localStorage, and a thin React UI.
Spec: `docs/design/2026-10-02-whodoku-spec.md`.

**Tech Stack:** Vite, React 18, TypeScript strict, Vitest, vite-plugin-pwa, Playwright,
GitHub Actions, GitHub Pages.

---

## Shared interfaces (all later tasks use exactly these names)

```ts
// src/engine/types.ts
export type ObjectKind = 'chair' | 'rug' | 'water' | 'table' | 'shelf' | 'plant' | 'rock' | 'tree' | 'tv'
export const OCCUPIABLE_KINDS: readonly ObjectKind[] = ['chair', 'rug', 'water']
export interface Pos { r: number; c: number }
export interface Cell { room: number; object: ObjectKind | null }
export interface Suspect { name: string }
export type Placement = Pos[]            // index = suspect index
export type Clue =
  | { type: 'inRoom'; suspect: number; room: number }
  | { type: 'notInRoom'; suspect: number; room: number }
  | { type: 'onObject'; suspect: number; kind: ObjectKind }
  | { type: 'notOnObject'; suspect: number; kind: ObjectKind }
  | { type: 'besideObject'; suspect: number; kind: ObjectKind }
  | { type: 'notBesideObject'; suspect: number; kind: ObjectKind }
  | { type: 'besideSuspect'; suspect: number; other: number }
  | { type: 'inColumn'; suspect: number; col: number }
  | { type: 'inRow'; suspect: number; row: number }
  | { type: 'northOf'; suspect: number; other: number; delta: number } // suspect.r = other.r - delta
  | { type: 'aloneInRoom'; suspect: number }
  | { type: 'withOneOther'; suspect: number }       // room holds exactly 2 suspects
  | { type: 'onlyOnObject'; suspect: number; kind: ObjectKind }
  | { type: 'sameRoomAs'; suspect: number; other: number }
export interface Puzzle {
  size: number
  cells: Cell[][]          // cells[r][c]
  rooms: string[]          // room names, index = Cell.room
  suspects: Suspect[]      // length === size
  victim: number
  clues: Clue[]            // clues[i] belongs to suspect i; clues[victim] is withOneOther
}
export type Tier = 'easy' | 'medium' | 'hard'
```

Engine exports: `mulberry32`, `hashSeed`, `evaluate`, `renderClue`, `isLegalPlacement`,
`isSolved`, `killerOf`, `countSolutions`, `solve`, `generate`, `dateKey`, `tierForDate`,
`dailyPuzzle`.

---

### Task 1: Repo and scaffold
- [ ] Create public GitHub repo `ekadetov/whodoku`, set `origin`, push `main`.
- [ ] Scaffold Vite react-ts at repo root, add Vitest, ESLint/Prettier already in template.
- [ ] Set `base: '/whodoku/'` in `vite.config.ts`, add `test` script, MIT `LICENSE`, `.gitignore`.
- [ ] Verify: `npm run build` and `npm test` run. Commit.

### Task 2: RNG (`src/engine/rng.ts`, test `rng.test.ts`)
- [ ] Tests: same seed gives same sequence; different seeds differ; values in [0,1);
  `hashSeed('2026-10-02')` is stable and an unsigned 32-bit int.
- [ ] Implement `mulberry32(seed): () => number`, `hashSeed(s): number` (FNV-1a), plus
  helpers `randInt(rng, n)`, `shuffle(rng, arr)`, `pick(rng, arr)`.

### Task 3: Types and clues (`types.ts`, `clues.ts`, test `clues.test.ts`)
- [ ] Add the shared interfaces above.
- [ ] Table-driven tests on a small hand-built 4x4 puzzle: one true and one false case per clue
  type, `renderClue` text per type, `isLegalPlacement` rejecting shared row, shared column,
  blocking cell.
- [ ] Implement `evaluate(clue, puzzle, placement)`, `renderClue(clue, puzzle)`,
  `isLegalPlacement(puzzle, placement)`, `killerOf(puzzle, placement)`,
  `isSolved(puzzle, placement)` (legal and every clue true).

### Task 4: Solver (`src/engine/solver.ts`, test `solver.test.ts`)
- [ ] Tests on hand-built puzzles: zero, exactly one, and many solutions; limit respected.
- [ ] Implement backtracking: per-suspect domains from unary clues, order by smallest domain,
  row/column exclusivity, binary clue check when both suspects are placed, full `evaluate` at
  the leaf. `countSolutions(puzzle, limit)` and `solve(puzzle)` returning the first placement.

### Task 5: Layout (`src/engine/layout.ts`, test `layout.test.ts`)
- [ ] Tests: every room is connected, covers all cells, room count as requested, objects only on
  allowed kinds, same seed same layout.
- [ ] Implement random multi-source growth for rooms, original room-name pool, object scattering
  with per-kind probabilities.

### Task 6: Generator (`src/engine/generator.ts`, test `generator.test.ts`)
- [ ] Property tests over 50 seeds per tier: exactly one solution; permutation rows/cols; no
  blocking cell used; victim room holds exactly two suspects; same seed byte-identical JSON;
  size 10 finishes within 250 ms median.
- [ ] Implement random legal placement, victim selection, true-candidate clue enumeration per
  suspect, tier-weighted clue choice, hill-climb on capped solution count until unique, deterministic
  derived-seed retry on failure.

### Task 7: Daily (`src/engine/daily.ts`, test `daily.test.ts`)
- [ ] Tests: `dateKey(new Date('2026-10-02T23:59:59Z'))` is `2026-10-02`; weekday-to-tier rotation;
  `dailyPuzzle('2026-10-02')` deep-equals itself and is a snapshot-stable puzzle id.
- [ ] Implement UTC date key, tier rotation (Mon, Tue easy; Wed, Thu medium; Fri to Sun hard),
  `dailyPuzzle(key)`.

### Task 8: State (`src/state/`, tests alongside)
- [ ] `streak.ts`: `recordSolve(streak, dateKey)`; consecutive day extends, gap resets to 1, same
  day idempotent, best updated. Tests for each.
- [ ] `storage.ts`: versioned load/save, corrupt JSON or unknown version gives fresh state,
  missing localStorage tolerated. Tests with a fake storage.
- [ ] `reducer.ts`: actions `select`, `place`, `remove`, `toggleMark`, `reset`, `solved`.
  Placement onto an occupied cell swaps; placing a suspect elsewhere moves it. Tests.

### Task 9: UI (`src/ui/`, `src/App.tsx`, `src/index.css`)
- [ ] `Board`: grid, room borders from adjacent-cell room differences, object glyphs (unicode
  escapes only), suspect chips, row/column conflict highlighting, X marks.
- [ ] `CluePanel`: one card per suspect with rendered clue, strike-through toggle, victim styled.
- [ ] `SuspectTray`, `Toolbar` (Check, Reset), `WinDialog` with accusation, `Stats` (streak).
- [ ] `App`: loads `dailyPuzzle(dateKey(new Date()))`, wires reducer and storage.
- [ ] Component tests: placing a suspect, conflict highlight, accusing the right and wrong killer.

### Task 10: PWA
- [ ] Add `vite-plugin-pwa` with manifest and 192/512 icons (original artwork), precache build.
- [ ] Verify build output contains `manifest.webmanifest` and `sw.js`.

### Task 11: CI and deploy
- [ ] `.github/workflows/ci.yml` (install, typecheck, lint, test, build).
- [ ] `.github/workflows/deploy.yml` (build, upload pages artifact, deploy) on push to `main`.
- [ ] Enable Pages with source "GitHub Actions" via `gh api`. Verify the live URL responds.

### Task 12: E2E and docs
- [ ] Playwright smoke test: import the engine, compute today's solution, click it in through the
  UI, expect the accusation dialog.
- [ ] README: rules, dev commands, deploy notes, legal note.
- [ ] Final full run: typecheck, lint, tests, build, e2e. Push.
