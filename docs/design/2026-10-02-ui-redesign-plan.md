# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-column UI with the three-column layout from the UI spec (suspect cards with clues, a bold illustrated board, a tools panel), with drag-to-mark X and eraser strokes, undo, hold-to-clear, and drag-to-place suspects.

**Architecture:** Game state gains a `tool` and an undo `history`; one `paint` action applies a whole stroke. Tools are plugin data (`ToolDef.paint`), so the board has no hard-coded X or eraser. Art is data too: object sprites are plain shape lists in the theme (replacing emoji glyphs), portraits are generated from names, and room textures are generated SVG tiles. The board turns pointer positions into cells with pure geometry helpers.

**Tech Stack:** TypeScript 6, React 19, Vitest 5, Playwright, Vite 8, `@fontsource/inter` and `@fontsource/caveat`. Spec: `docs/design/2026-10-02-ui-redesign-spec.md`.

**Prerequisite:** the plugin-kernel plan (`2026-10-02-plugin-kernel-plan.md`) is merged. Baseline before starting: `npx tsc -b && npx vitest run` passes.

**Conventions for every task:**
- Run commands from the repo root. Commit messages are imperative and short. No Co-Authored-By trailers.
- Code comments only where the reason is non-obvious. ASCII only.
- Each task ends green (`npx tsc -b && npx vitest run`) and is committed on its own.
- "Edit" blocks are unified diffs against the previous task's result; apply them with your editor or `git apply`. "Create" and "Replace the whole of" blocks are complete files.

**Decisions made while prototyping (the spec was updated to match):**
- The existing `reset` action is the clear-all action (now undoable); there is no separate `clearAll`.
- Blocked cells use `aria-disabled` instead of `disabled`, because browsers do not reliably dispatch pointer events on disabled buttons and a stroke may start or pass over a blocked cell.
- On phones the suspect cards are a horizontally scrolling strip above the board, so the board stays near the top of the screen. Dragging a card onto the board works with a mouse; on touch screens, tap a card and then a square.
- Theme-level UI tokens (moving the CSS variables into `ThemeDef`) are out of scope; the variables live in `src/index.css` and follow `prefers-color-scheme`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/state/reducer.ts` | `tool`, `history`, `paint`, `undo`, undoable `reset` |
| `src/engine/plugin.ts` | `PaintMode`, `ToolDef.paint` and `holdToClear`, `SpriteDef`/`SpriteShape`, `ThemeObject.sprite` |
| `src/plugins/classic/tools.ts`, `sprites.ts`, `theme.ts` | Classic tool rules and sprite data |
| `src/ui/boardGeometry.ts` | `cellAt` (point to cell) and `lineCells` (gap-free strokes) |
| `src/ui/Board.tsx` | Surface, sprites, portrait tokens, crosses, pointer strokes, keyboard clicks |
| `src/ui/SuspectPanel.tsx` | Portrait cards with clue cards, strike-through, drag-to-place with a ghost |
| `src/ui/ToolsPanel.tsx` | X, Eraser (hold to clear), Undo, Hint, Submit, How to play |
| `src/ui/Game.tsx` | Wires state, panels and the check/submit/accuse flow |
| `src/ui/art/` | `Sprite.tsx`, `lookup.ts`, `portrait.ts`, `texture.ts` |
| `src/ui/palette.ts` | `roomHue`, `suspectColor` (moved from `glyphs.ts`) |
| `src/index.css` | Visual language: hard shadows, wall weights, cards, board, tools, dark mode, motion |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch and confirm the baseline**

```bash
git switch -c ui-redesign
npx tsc -b && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass; note the count.

---

### Task 1: Tool, undo history and batch painting in the reducer

The reducer learns the active tool, a capped undo history, and a `paint` action that applies a whole drag stroke as one undoable step. No UI yet.

**Files:**
- Modify: `src/engine/plugin.ts`, `src/state/reducer.ts`, `src/ui/Game.tsx`
- Test: `src/state/reducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Edit `src/state/reducer.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/state/reducer.test.ts b/src/state/reducer.test.ts
index d6bb655..49dda80 100644
--- a/src/state/reducer.test.ts
+++ b/src/state/reducer.test.ts
@@ -84,2 +84,87 @@ describe('newGame', () => {
   })
 })
+
+describe('tools and history', () => {
+  const at = (r: number, c: number) => ({ r, c })
+  const placed = (suspect: number, r: number, c: number, from = start()) =>
+    reduce(reduce(from, { type: 'select', suspect }), { type: 'place', pos: at(r, c) })
+
+  it('starts on the select tool with an empty history', () => {
+    const state = start()
+    expect(state.tool).toBe('select')
+    expect(state.history).toEqual([])
+  })
+
+  it('switching to a stroke tool clears the selection, and picking a suspect switches back', () => {
+    let state = reduce(start(), { type: 'select', suspect: 2 })
+    state = reduce(state, { type: 'setTool', tool: 'x' })
+    expect(state.tool).toBe('x')
+    expect(state.selected).toBeNull()
+    state = reduce(state, { type: 'select', suspect: 1 })
+    expect(state.tool).toBe('select')
+    expect(state.selected).toBe(1)
+  })
+
+  it('marks every painted cell except those holding a suspect', () => {
+    const state = reduce(placed(0, 1, 1), { type: 'paint', cells: [at(1, 0), at(1, 1), at(1, 2), at(1, 0)], mode: 'mark' })
+    expect(state.progress.marks).toEqual(['1,0', '1,2'])
+  })
+
+  it('unmarks painted cells and leaves other marks alone', () => {
+    let state = reduce(start(), { type: 'paint', cells: [at(0, 0), at(0, 1), at(0, 2)], mode: 'mark' })
+    state = reduce(state, { type: 'paint', cells: [at(0, 0), at(0, 2)], mode: 'unmark' })
+    expect(state.progress.marks).toEqual(['0,1'])
+  })
+
+  it('erases marks and suspects on the painted cells', () => {
+    let state = placed(0, 1, 1)
+    state = placed(1, 2, 2, state)
+    state = reduce(state, { type: 'paint', cells: [at(0, 3)], mode: 'mark' })
+    state = reduce(state, { type: 'paint', cells: [at(0, 3), at(1, 1)], mode: 'erase' })
+    expect(state.progress.marks).toEqual([])
+    expect(state.progress.placements).toEqual({ 1: at(2, 2) })
+  })
+
+  it('treats a whole stroke as one undo step', () => {
+    let state = reduce(start(), { type: 'paint', cells: [at(0, 0), at(0, 1), at(0, 2)], mode: 'mark' })
+    expect(state.history).toHaveLength(1)
+    state = reduce(state, { type: 'undo' })
+    expect(state.progress.marks).toEqual([])
+    expect(state.history).toEqual([])
+  })
+
+  it('undoes a placement back to the previous one', () => {
+    let state = placed(0, 0, 0)
+    state = placed(0, 2, 2, state)
+    state = reduce(state, { type: 'undo' })
+    expect(state.progress.placements).toEqual({ 0: at(0, 0) })
+    expect(state.selected).toBeNull()
+  })
+
+  it('does not record history for a stroke that changes nothing', () => {
+    const state = reduce(start(), { type: 'paint', cells: [at(0, 0)], mode: 'unmark' })
+    expect(state.history).toEqual([])
+    expect(reduce(state, { type: 'undo' })).toEqual(state)
+  })
+
+  it('keeps only the most recent 100 steps', () => {
+    let state = start()
+    for (let i = 0; i < 120; i++) state = reduce(state, { type: 'toggleMark', pos: at(0, i % 2) })
+    expect(state.history).toHaveLength(100)
+  })
+
+  it('can undo a reset', () => {
+    let state = placed(0, 0, 0)
+    state = reduce(state, { type: 'reset' })
+    expect(state.progress.placements).toEqual({})
+    state = reduce(state, { type: 'undo' })
+    expect(state.progress.placements).toEqual({ 0: at(0, 0) })
+  })
+
+  it('ignores painting, undo and tool changes once solved', () => {
+    const solved = reduce(placed(0, 0, 0), { type: 'solved', at: 5000 })
+    expect(reduce(solved, { type: 'paint', cells: [at(1, 1)], mode: 'mark' })).toEqual(solved)
+    expect(reduce(solved, { type: 'undo' })).toEqual(solved)
+    expect(reduce(solved, { type: 'setTool', tool: 'x' })).toEqual(solved)
+  })
+})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: FAIL, the new `tools and history` tests (no `tool`/`history` on the state, unknown `paint`, `undo` and `setTool` actions).

- [ ] **Step 3: Implement**

Edit `src/engine/plugin.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/plugin.ts b/src/engine/plugin.ts
index 0cd9682..45abea8 100644
--- a/src/engine/plugin.ts
+++ b/src/engine/plugin.ts
@@ -5,4 +5,6 @@ export type ClueScope = 'unary' | 'binary' | 'global'
 export type PartialPlacement = (Pos | undefined)[]
 
+export type PaintMode = 'mark' | 'unmark' | 'erase'
+
 export interface ObjectKindDef {
   id: string
```

Edit `src/state/reducer.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/state/reducer.ts b/src/state/reducer.ts
index 3eff8ff..55389d5 100644
--- a/src/state/reducer.ts
+++ b/src/state/reducer.ts
@@ -1,16 +1,24 @@
+import type { PaintMode } from '../engine/plugin'
 import type { Pos } from '../engine/types'
 import type { DayProgress } from './storage'
 
+export const HISTORY_LIMIT = 100
+
 export interface GameState {
   progress: DayProgress
   selected: number | null
+  tool: string
+  history: DayProgress[]
 }
 
 export type Action =
   | { type: 'select'; suspect: number | null }
+  | { type: 'setTool'; tool: string }
   | { type: 'place'; pos: Pos }
   | { type: 'remove'; suspect: number }
   | { type: 'toggleMark'; pos: Pos }
+  | { type: 'paint'; cells: Pos[]; mode: PaintMode }
   | { type: 'toggleStrike'; suspect: number }
+  | { type: 'undo' }
   | { type: 'reset' }
   | { type: 'solved'; at: number }
@@ -22,4 +30,6 @@ export function newGame(dateKey: string, now: number, puzzleId?: string): GameSt
     progress: { dateKey, puzzleId, placements: {}, marks: [], struck: [], startedAt: now, solvedAt: null },
     selected: null,
+    tool: 'select',
+    history: [],
   }
 }
@@ -29,4 +39,10 @@ function toggle<T>(items: T[], item: T): T[] {
 }
 
+/** Records the previous progress for undo, but only when the action actually changed something. */
+function edit(state: GameState, progress: DayProgress, patch: Partial<GameState> = {}): GameState {
+  if (progress === state.progress) return { ...state, ...patch }
+  return { ...state, ...patch, progress, history: [...state.history, state.progress].slice(-HISTORY_LIMIT) }
+}
+
 function placeSelected(state: GameState, pos: Pos): GameState {
   const { selected, progress } = state
@@ -43,5 +59,24 @@ function placeSelected(state: GameState, pos: Pos): GameState {
   placements[selected] = pos
   const marks = progress.marks.filter((m) => m !== posKey(pos))
-  return { progress: { ...progress, placements, marks }, selected: null }
+  return edit(state, { ...progress, placements, marks }, { selected: null })
+}
+
+function paint(state: GameState, cells: Pos[], mode: PaintMode): GameState {
+  const { progress } = state
+  const keys = new Set(cells.map(posKey))
+  const occupied = new Set(Object.values(progress.placements).map(posKey))
+  let marks = progress.marks
+  let placements = progress.placements
+  if (mode === 'mark') {
+    const fresh = [...keys].filter((key) => !occupied.has(key) && !marks.includes(key))
+    if (fresh.length > 0) marks = [...marks, ...fresh]
+  } else {
+    if (marks.some((key) => keys.has(key))) marks = marks.filter((key) => !keys.has(key))
+    if (mode === 'erase' && Object.values(placements).some((pos) => keys.has(posKey(pos)))) {
+      placements = Object.fromEntries(Object.entries(placements).filter(([, pos]) => !keys.has(posKey(pos))))
+    }
+  }
+  if (marks === progress.marks && placements === progress.placements) return state
+  return edit(state, { ...progress, marks, placements })
 }
 
@@ -51,5 +86,8 @@ export function reduce(state: GameState, action: Action): GameState {
   switch (action.type) {
     case 'select':
-      return progress.solvedAt !== null ? state : { ...state, selected: action.suspect }
+      if (progress.solvedAt !== null) return state
+      return { ...state, selected: action.suspect, tool: action.suspect === null ? state.tool : 'select' }
+    case 'setTool':
+      return { ...state, tool: action.tool, selected: action.tool === 'select' ? state.selected : null }
     case 'place':
       return placeSelected(state, action.pos)
@@ -57,12 +95,19 @@ export function reduce(state: GameState, action: Action): GameState {
       const placements = { ...progress.placements }
       delete placements[action.suspect]
-      return { ...state, progress: { ...progress, placements } }
+      return edit(state, { ...progress, placements })
     }
     case 'toggleMark':
-      return { ...state, progress: { ...progress, marks: toggle(progress.marks, posKey(action.pos)) } }
+      return edit(state, { ...progress, marks: toggle(progress.marks, posKey(action.pos)) })
+    case 'paint':
+      return paint(state, action.cells, action.mode)
     case 'toggleStrike':
       return { ...state, progress: { ...progress, struck: toggle(progress.struck, action.suspect) } }
+    case 'undo': {
+      const previous = state.history[state.history.length - 1]
+      if (!previous) return state
+      return { ...state, progress: previous, history: state.history.slice(0, -1), selected: null }
+    }
     case 'reset':
-      return { progress: { ...progress, placements: {}, marks: [] }, selected: null }
+      return edit(state, { ...progress, placements: {}, marks: [] }, { selected: null })
     case 'solved':
       return { ...state, progress: { ...progress, solvedAt: action.at } }
```

Edit `src/ui/Game.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.tsx b/src/ui/Game.tsx
index fd85a29..c0d44e5 100644
--- a/src/ui/Game.tsx
+++ b/src/ui/Game.tsx
@@ -41,5 +41,5 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
   const [game, dispatch] = useReducer(reduce, undefined, () =>
     saved.today?.dateKey === dateKey && saved.today.puzzleId === puzzleId
-      ? { progress: saved.today, selected: null }
+      ? { ...newGame(dateKey, now(), puzzleId), progress: saved.today }
       : newGame(dateKey, now(), puzzleId),
   )
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add tool, undo history and batch painting to the reducer"
```

---

### Task 2: Tools carry their own paint rules

A tool is data: stroke tools say what a drag does from the first cell (`paint`), and the eraser asks for hold-to-clear. The board will read these instead of hard-coding X and eraser.

**Files:**
- Modify: `src/engine/plugin.ts`, `src/plugins/classic/tools.ts`
- Test: `src/plugins/classic/classic.test.ts`

- [ ] **Step 1: Write the failing tests**

Edit `src/plugins/classic/classic.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/classic.test.ts b/src/plugins/classic/classic.test.ts
index 597b162..3843fee 100644
--- a/src/plugins/classic/classic.test.ts
+++ b/src/plugins/classic/classic.test.ts
@@ -30,3 +30,13 @@ describe('classic plugin', () => {
     expect(registry.puzzleSource('daily').id).toBe('daily')
   })
+
+  it('gives the stroke tools their paint rules', () => {
+    const tool = (id: string) => registry.tools().find((t) => t.id === id)!
+    expect(tool('select').paint).toBeUndefined()
+    expect(tool('x').paint!({ marked: false, occupied: false })).toBe('mark')
+    expect(tool('x').paint!({ marked: true, occupied: false })).toBe('unmark')
+    expect(tool('eraser').paint!({ marked: false, occupied: true })).toBe('erase')
+    expect(tool('eraser').holdToClear).toBe(true)
+    expect(tool('x').holdToClear).toBeUndefined()
+  })
 })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/plugins/classic/classic.test.ts`
Expected: FAIL, `gives the stroke tools their paint rules` (`paint` is undefined).

- [ ] **Step 3: Implement**

Edit `src/engine/plugin.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/plugin.ts b/src/engine/plugin.ts
index 45abea8..fa153cc 100644
--- a/src/engine/plugin.ts
+++ b/src/engine/plugin.ts
@@ -43,7 +43,15 @@ export interface RuleDef {
 }
 
+export interface PaintStart {
+  marked: boolean
+  occupied: boolean
+}
+
 export interface ToolDef {
   id: string
   label: string
+  /** Present on stroke tools: decides what a drag does from the state of the first cell. */
+  paint?(start: PaintStart): PaintMode
+  holdToClear?: boolean
 }
 
```

Replace the whole of `src/plugins/classic/tools.ts`:

```ts
import type { ToolDef } from '../../engine/plugin'

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'x', label: 'Mark', paint: ({ marked }) => (marked ? 'unmark' : 'mark') },
  { id: 'eraser', label: 'Eraser', paint: () => 'erase', holdToClear: true },
]
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give tools paint rules and hold-to-clear"
```

---

### Task 3: Data sprites replace emoji glyphs

Object art becomes plain data (shape lists on a 100 x 100 canvas) stored in the theme, so a future theme can ship its art as JSON. A small `Sprite` component renders only whitelisted fields. `glyphs.ts` is split: the palette helpers move to `palette.ts` and sprite lookup to `art/lookup.ts`.

**Files:**
- Create: `src/plugins/classic/sprites.ts`, `src/ui/art/Sprite.tsx`, `src/ui/art/lookup.ts`, `src/ui/palette.ts`
- Modify: `src/engine/plugin.ts`, `src/engine/registry.ts`, `src/plugins/classic/theme.ts`, `src/ui/Board.tsx`, `src/ui/Legend.tsx`, `src/ui/SuspectTray.tsx`, `src/ui/CluePanel.tsx`, `src/index.css`
- Delete: `src/ui/glyphs.ts`
- Test: `src/engine/registry.test.ts`, `src/plugins/extensibility.test.ts`, `src/plugins/classic/classic.test.ts`, `src/plugins/classic/layout.test.ts`, `src/ui/art/Sprite.test.tsx`

- [ ] **Step 1: Write the failing tests**

Edit `src/engine/registry.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.test.ts b/src/engine/registry.test.ts
index bf24a03..295a0ee 100644
--- a/src/engine/registry.test.ts
+++ b/src/engine/registry.test.ts
@@ -1,6 +1,8 @@
 import { describe, expect, it } from 'vitest'
-import type { Plugin, ThemeDef } from './plugin'
+import type { Plugin, SpriteDef, ThemeDef } from './plugin'
 import { createRegistry } from './registry'
 
+const SPRITE: SpriteDef = { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }
+
 const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
   id: 't',
@@ -8,6 +10,6 @@ const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
   suspects: ['X', 'Y'],
   objects: {
-    seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
-    wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0.1 },
+    seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+    wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
   },
   ...overrides,
@@ -130,22 +132,24 @@ describe('theme validation', () => {
 
   it('rejects an object that is not a registered kind', () => {
-    const objects = { ghost: { noun: 'a ghost', standingOn: 'on a ghost', glyph: 'g', weight: 0.1 } }
+    const objects = { ghost: { noun: 'a ghost', standingOn: 'on a ghost', sprite: SPRITE, weight: 0.1 } }
     expect(() => createRegistry().register(withTheme({ objects }))).toThrow('"ghost" is not a registered object kind')
   })
 
-  it('rejects an object without a noun or glyph', () => {
+  it('rejects an object without a noun or a sprite', () => {
     const objects = {
-      seat: { noun: '', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
-      wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0.1 },
+      seat: { noun: '', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
     }
-    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a noun, standingOn and glyph')
+    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a noun, standingOn and a sprite')
+    const blank = { ...objects, seat: { ...objects.seat, noun: 'a seat', sprite: { shapes: [] } } }
+    expect(() => createRegistry().register(withTheme({ objects: blank }))).toThrow('needs a noun, standingOn and a sprite')
   })
 
   it('needs both a blocking and an occupiable object that can spawn', () => {
-    const onlySeat = { seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 } }
+    const onlySeat = { seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 } }
     expect(() => createRegistry().register(withTheme({ objects: onlySeat }))).toThrow('at least one blocking object')
     const wallNeverSpawns = {
-      seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
-      wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0 },
+      seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0 },
     }
     expect(() => createRegistry().register(withTheme({ objects: wallNeverSpawns }))).toThrow('at least one blocking object')
```

Edit `src/plugins/classic/classic.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/classic.test.ts b/src/plugins/classic/classic.test.ts
index 3843fee..8bbcfc9 100644
--- a/src/plugins/classic/classic.test.ts
+++ b/src/plugins/classic/classic.test.ts
@@ -21,4 +21,10 @@ describe('classic plugin', () => {
   })
 
+  it('draws every themed object with at least one shape', () => {
+    for (const object of Object.values(registry.theme('classic').objects)) {
+      expect(object.sprite.shapes.length).toBeGreaterThan(0)
+    }
+  })
+
   it('registers every clue type and the victim rule', () => {
     expect(registry.clueTypes()).toHaveLength(14)
```

Edit `src/plugins/classic/layout.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/layout.test.ts b/src/plugins/classic/layout.test.ts
index c05b621..8cb5162 100644
--- a/src/plugins/classic/layout.test.ts
+++ b/src/plugins/classic/layout.test.ts
@@ -66,6 +66,6 @@ describe('generateLayout', () => {
       suspects: ['S'],
       objects: {
-        chair: { noun: 'a chair', standingOn: 'on a chair', glyph: 'c', weight: 0.5 },
-        table: { noun: 'a table', standingOn: 'on a table', glyph: 't', weight: 0.4 },
+        chair: { noun: 'a chair', standingOn: 'on a chair', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.5 },
+        table: { noun: 'a table', standingOn: 'on a table', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.4 },
       },
     }
```

Edit `src/plugins/extensibility.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/extensibility.test.ts b/src/plugins/extensibility.test.ts
index 94f9de7..5cca8a4 100644
--- a/src/plugins/extensibility.test.ts
+++ b/src/plugins/extensibility.test.ts
@@ -2,9 +2,11 @@ import { beforeAll, describe, expect, it } from 'vitest'
 import { evaluate, renderClue } from '../engine/clues'
 import { tiny } from '../engine/fixtures'
-import type { Plugin } from '../engine/plugin'
+import type { Plugin, SpriteDef } from '../engine/plugin'
 import { registry } from '../engine/registry'
 import { countSolutions } from '../engine/solver'
 import { generate } from './classic/generator'
 
+const SPRITE: SpriteDef = { shapes: [{ kind: 'rect', x: 10, y: 10, w: 80, h: 80, fill: '#444' }] }
+
 const NOIR_ROOMS = ['Alley', 'Bar', 'Docks', 'Office', 'Casino', 'Hotel', 'Rooftop', 'Subway']
 const NOIR_SUSPECTS = ['Sam', 'Vera', 'Lou', 'Mae', 'Hank', 'Dot', 'Ray', 'Ida']
@@ -20,6 +22,6 @@ const noir: Plugin = {
       suspects: NOIR_SUSPECTS,
       objects: {
-        chair: { noun: 'a barstool', standingOn: 'perched on a barstool', glyph: 'S', weight: 0.1 },
-        shelf: { noun: 'a safe', standingOn: 'on a safe', glyph: 'X', weight: 0.05 },
+        chair: { noun: 'a barstool', standingOn: 'perched on a barstool', sprite: SPRITE, weight: 0.1 },
+        shelf: { noun: 'a safe', standingOn: 'on a safe', sprite: SPRITE, weight: 0.05 },
       },
     })
```

Create `src/ui/art/Sprite.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SpriteDef } from '../../engine/plugin'
import { Sprite } from './Sprite'

afterEach(cleanup)

describe('Sprite', () => {
  it('draws one element per shape on a 100 x 100 canvas', () => {
    const sprite: SpriteDef = {
      shapes: [
        { kind: 'rect', x: 1, y: 2, w: 3, h: 4, fill: 'red' },
        { kind: 'ellipse', cx: 5, cy: 6, rx: 7, ry: 8, stroke: 'blue', sw: 2 },
        { kind: 'path', d: 'M0 0 L10 10', stroke: 'black', sw: 1 },
      ],
    }
    const { container } = render(<Sprite sprite={sprite} />)
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 100')
    expect(container.querySelectorAll('rect, ellipse, path')).toHaveLength(3)
    expect(container.querySelector('rect')).toHaveAttribute('width', '3')
    expect(container.querySelector('ellipse')).toHaveAttribute('stroke-width', '2')
  })

  it('ignores fields outside the whitelist', () => {
    const hostile = { kind: 'rect', x: 0, y: 0, w: 5, h: 5, onload: 'alert(1)', href: 'javascript:x' } as never
    const { container } = render(<Sprite sprite={{ shapes: [hostile] }} />)
    const rect = container.querySelector('rect')!
    expect(rect).not.toHaveAttribute('onload')
    expect(rect).not.toHaveAttribute('href')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/engine/registry.test.ts src/plugins src/ui/art`
Expected: FAIL. Themes in the tests use `sprite` but the registry still requires a `glyph`; `Sprite` does not exist.

- [ ] **Step 3: Implement**

Edit `src/engine/plugin.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/plugin.ts b/src/engine/plugin.ts
index fa153cc..28a4d15 100644
--- a/src/engine/plugin.ts
+++ b/src/engine/plugin.ts
@@ -13,8 +13,24 @@ export interface ObjectKindDef {
 }
 
+interface Paint {
+  fill?: string
+  stroke?: string
+  sw?: number
+}
+
+/** Drawing instructions on a 100 x 100 canvas. Plain data, so a theme can be shipped as JSON. */
+export type SpriteShape =
+  | ({ kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number } & Paint)
+  | ({ kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint)
+  | ({ kind: 'path'; d: string } & Paint)
+
+export interface SpriteDef {
+  shapes: readonly SpriteShape[]
+}
+
 export interface ThemeObject {
   noun: string
   standingOn: string
-  glyph: string
+  sprite: SpriteDef
   weight: number
 }
```

Edit `src/engine/registry.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.ts b/src/engine/registry.ts
index dd716ac..1fffb60 100644
--- a/src/engine/registry.ts
+++ b/src/engine/registry.ts
@@ -64,5 +64,7 @@ export function validateTheme(theme: ThemeDef, kinds: ReadonlyMap<string, Object
   for (const [id, object] of entries) {
     if (!kinds.has(id)) fail(`object "${id}" is not a registered object kind`)
-    if (!object.noun || !object.standingOn || !object.glyph) fail(`object "${id}" needs a noun, standingOn and glyph`)
+    if (!object.noun || !object.standingOn || object.sprite.shapes.length === 0) {
+      fail(`object "${id}" needs a noun, standingOn and a sprite`)
+    }
   }
   const spawning = entries.filter(([, object]) => object.weight > 0).map(([id]) => kinds.get(id)!)
```

Edit `src/index.css` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/index.css b/src/index.css
index 4f6b1e8..9d91a78 100644
--- a/src/index.css
+++ b/src/index.css
@@ -38,5 +38,6 @@ button { font: inherit; cursor: pointer; }
 .cell.conflict { outline: 3px solid #d12; outline-offset: -3px; }
 .cell.picked { outline: 3px solid var(--accent); outline-offset: -3px; }
-.cell .glyph { position: absolute; top: 2%; left: 6%; line-height: 1; }
+.cell .sprite { position: absolute; inset: 7%; width: 86%; height: 86%; filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.35)); }
+.legend-sprite { width: 1.2rem; height: 1.2rem; }
 .cell .mark { color: #a22; font-weight: 700; font-size: 1.3em; }
 .cell .chip { width: 62%; height: 62%; font-size: 0.9em; }
```

Create `src/plugins/classic/sprites.ts`:

```ts
import type { SpriteDef, SpriteShape } from '../../engine/plugin'

const INK = '#1f2430'

const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, stroke = INK, sw = 3): SpriteShape => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  rx,
  fill,
  stroke,
  sw,
})

const path = (d: string, fill: string, stroke = INK, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke, sw })

const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, stroke = 'none', sw = 0): SpriteShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
  fill,
  stroke,
  sw,
})

const BOOKS = ['#e85d75', '#f2c14e', '#58b09c', '#7aa6e0']
const books = (y: number, h: number): SpriteShape[] =>
  [24, 34, 44, 54, 64].map((x, i) => rect(x, y, 8, h, BOOKS[i % BOOKS.length], 1, INK, 1.5))

export const SPRITES: Record<string, SpriteDef> = {
  chair: {
    shapes: [
      rect(8, 40, 18, 44, '#cfdde9', 9),
      rect(74, 40, 18, 44, '#cfdde9', 9),
      rect(16, 44, 68, 38, '#dfe9f1', 12),
      rect(20, 12, 60, 44, '#eef3f7', 14),
      rect(28, 50, 44, 26, '#f6f9fb', 8, INK, 2),
    ],
  },
  rug: {
    shapes: [rect(6, 6, 88, 88, '#c9a6d4', 6), rect(16, 16, 68, 68, '#e1c9e8', 3, '#8e6aa0', 2)],
  },
  water: {
    shapes: [
      rect(4, 4, 92, 92, '#8fc8f0', 8),
      path('M10 38 Q22 26 34 38 T58 38 T82 38', 'none', '#ffffff', 4),
      path('M18 62 Q30 50 42 62 T66 62 T90 62', 'none', '#ffffff', 4),
    ],
  },
  table: {
    shapes: [
      rect(14, 78, 8, 12, '#c99f2e', 1),
      rect(78, 78, 8, 12, '#c99f2e', 1),
      rect(10, 22, 80, 58, '#f6d776', 6),
      rect(17, 29, 66, 44, 'none', 4, '#d9b74a', 2),
    ],
  },
  shelf: {
    shapes: [
      rect(14, 8, 72, 84, '#6b5b95', 4),
      rect(20, 14, 60, 24, '#3b3363', 1, INK, 1.5),
      rect(20, 42, 60, 24, '#3b3363', 1, INK, 1.5),
      rect(20, 70, 60, 16, '#3b3363', 1, INK, 1.5),
      ...books(16, 20),
      ...books(44, 20),
    ],
  },
  plant: {
    shapes: [
      path('M50 62 C30 50 24 30 34 10 C46 24 52 44 50 62 Z', '#4fbf8f'),
      path('M50 62 C70 50 76 30 66 10 C54 24 48 44 50 62 Z', '#4fbf8f'),
      path('M50 62 C42 44 44 24 50 6 C56 24 58 44 50 62 Z', '#3aa578'),
      path('M30 60 L70 60 L63 92 L37 92 Z', '#8a5cc2'),
    ],
  },
  rock: {
    shapes: [
      path('M14 78 C10 56 24 34 46 30 C70 26 90 44 88 70 C87 82 78 88 64 88 L28 88 C20 88 15 84 14 78 Z', '#7aa0ad'),
      ellipse(40, 50, 12, 7, '#a4c3cd'),
    ],
  },
  tree: {
    shapes: [
      rect(44, 72, 12, 20, '#8a5a3a', 1),
      path('M50 40 L90 82 L10 82 Z', '#3f9e6b'),
      path('M50 22 L84 60 L16 60 Z', '#4fb87a'),
      path('M50 6 L76 38 L24 38 Z', '#5cc98a'),
    ],
  },
  tv: {
    shapes: [
      rect(8, 18, 84, 54, '#2b2f3a', 6),
      rect(14, 24, 72, 42, '#6fb8e8', 3, INK, 2),
      path('M20 30 L44 30 L28 60 L20 60 Z', '#a9d8f3', 'none', 0),
      rect(38, 72, 24, 8, '#2b2f3a', 0),
      rect(28, 80, 44, 8, '#2b2f3a', 3),
    ],
  },
}
```

Edit `src/plugins/classic/theme.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/theme.ts b/src/plugins/classic/theme.ts
index 26f2eba..c01c491 100644
--- a/src/plugins/classic/theme.ts
+++ b/src/plugins/classic/theme.ts
@@ -1,3 +1,4 @@
 import type { ThemeDef } from '../../engine/plugin'
+import { SPRITES } from './sprites'
 
 export const classicTheme: ThemeDef = {
@@ -40,13 +41,13 @@ export const classicTheme: ThemeDef = {
   ],
   objects: {
-    chair: { noun: 'a chair', standingOn: 'sitting on a chair', glyph: '\u{1FA91}', weight: 0.1 },
-    rug: { noun: 'a rug', standingOn: 'on a rug', glyph: '\u{25A6}', weight: 0.06 },
-    water: { noun: 'the water', standingOn: 'in the water', glyph: '\u{1F4A7}', weight: 0.04 },
-    table: { noun: 'a table', standingOn: 'on a table', glyph: '\u{1F7EB}', weight: 0.05 },
-    shelf: { noun: 'a shelf', standingOn: 'on a shelf', glyph: '\u{1F4DA}', weight: 0.03 },
-    plant: { noun: 'a plant', standingOn: 'on a plant', glyph: '\u{1FAB4}', weight: 0.03 },
-    rock: { noun: 'a rock', standingOn: 'on a rock', glyph: '\u{1FAA8}', weight: 0.02 },
-    tree: { noun: 'a tree', standingOn: 'on a tree', glyph: '\u{1F333}', weight: 0.02 },
-    tv: { noun: 'a TV', standingOn: 'on a TV', glyph: '\u{1F4FA}', weight: 0.01 },
+    chair: { noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
+    rug: { noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
+    water: { noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
+    table: { noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
+    shelf: { noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
+    plant: { noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
+    rock: { noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
+    tree: { noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
+    tv: { noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
   },
 }
```

Edit `src/ui/Board.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Board.tsx b/src/ui/Board.tsx
index 586c54b..9ab3b8a 100644
--- a/src/ui/Board.tsx
+++ b/src/ui/Board.tsx
@@ -2,5 +2,7 @@ import { isOccupiable } from '../engine/types'
 import type { Pos, Puzzle } from '../engine/types'
 import { posKey } from '../state/reducer'
-import { glyphFor, roomHue, suspectColor } from './glyphs'
+import { Sprite } from './art/Sprite'
+import { spriteFor } from './art/lookup'
+import { roomHue, suspectColor } from './palette'
 
 interface BoardProps {
@@ -59,5 +61,5 @@ export function Board({ puzzle, placements, marks, selected, conflicts, onCellCl
             >
               {labelAt.has(key) && <span className="room-label">{labelAt.get(key)}</span>}
-              {cell.object && <span className="glyph">{glyphFor(puzzle, cell.object)}</span>}
+              {cell.object && <Sprite sprite={spriteFor(puzzle, cell.object)} className="sprite" />}
               {marks.has(key) && occupant === undefined && <span className="mark">x</span>}
               {occupant !== undefined && (
```

Edit `src/ui/CluePanel.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/CluePanel.tsx b/src/ui/CluePanel.tsx
index c3121ca..218d684 100644
--- a/src/ui/CluePanel.tsx
+++ b/src/ui/CluePanel.tsx
@@ -1,5 +1,5 @@
 import { renderClue } from '../engine/clues'
 import type { Puzzle } from '../engine/types'
-import { suspectColor } from './glyphs'
+import { suspectColor } from './palette'
 
 interface CluePanelProps {
```

Edit `src/ui/Legend.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Legend.tsx b/src/ui/Legend.tsx
index c3dbf42..9c8965b 100644
--- a/src/ui/Legend.tsx
+++ b/src/ui/Legend.tsx
@@ -1,5 +1,7 @@
 import { objectKindsIn } from '../engine/candidates'
 import type { Puzzle } from '../engine/types'
-import { glyphFor, roomHue } from './glyphs'
+import { Sprite } from './art/Sprite'
+import { spriteFor } from './art/lookup'
+import { roomHue } from './palette'
 
 export function Legend({ puzzle }: { puzzle: Puzzle }) {
@@ -17,5 +19,5 @@ export function Legend({ puzzle }: { puzzle: Puzzle }) {
         {objectKindsIn(puzzle).map((kind) => (
           <li key={kind}>
-            <span className="glyph">{glyphFor(puzzle, kind)}</span> {kind}
+            <Sprite sprite={spriteFor(puzzle, kind)} className="legend-sprite" /> {kind}
           </li>
         ))}
```

Edit `src/ui/SuspectTray.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/SuspectTray.tsx b/src/ui/SuspectTray.tsx
index 298745e..9d82427 100644
--- a/src/ui/SuspectTray.tsx
+++ b/src/ui/SuspectTray.tsx
@@ -1,4 +1,4 @@
 import type { Pos, Puzzle } from '../engine/types'
-import { suspectColor } from './glyphs'
+import { suspectColor } from './palette'
 
 interface SuspectTrayProps {
```

Create `src/ui/art/Sprite.tsx`:

```tsx
import type { SpriteDef, SpriteShape } from '../../engine/plugin'

function element(shape: SpriteShape, key: number) {
  const paint = {
    fill: shape.fill ?? 'none',
    stroke: shape.stroke ?? 'none',
    strokeWidth: shape.sw ?? 0,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (shape.kind) {
    case 'rect':
      return <rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} {...paint} />
    case 'ellipse':
      return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...paint} />
    case 'path':
      return <path key={key} d={shape.d} {...paint} />
  }
}

/** Renders only the whitelisted fields of each shape, so sprite data can never inject attributes. */
export function Sprite({ sprite, className }: { sprite: SpriteDef; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      {sprite.shapes.map(element)}
    </svg>
  )
}
```

Create `src/ui/art/lookup.ts`:

```ts
import type { SpriteDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import type { ObjectKind, Puzzle } from '../../engine/types'

export const spriteFor = (puzzle: Puzzle, kind: ObjectKind): SpriteDef =>
  registry.theme(puzzle.themeId).objects[kind].sprite
```

Delete `src/ui/glyphs.ts`:

```bash
git rm src/ui/glyphs.ts
```

Create `src/ui/palette.ts`:

```ts
const ROOM_HUES = [200, 30, 120, 280, 0, 60, 170, 320, 90, 240, 15, 150]

export const roomHue = (room: number): number => ROOM_HUES[room % ROOM_HUES.length]

export const suspectColor = (suspect: number): string => `hsl(${(suspect * 47) % 360} 65% 42%)`
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Replace emoji glyphs with data-driven sprites"
```

---

### Task 4: Generated portraits and room textures

Faces and room surfaces are pure functions, so every theme gets them for free: `portraitFor(name)` builds a faceless flat portrait from a hash of the name, and `roomSurface(room)` returns a pastel color plus a tiling SVG pattern.

**Files:**
- Create: `src/ui/art/portrait.ts`, `src/ui/art/texture.ts`
- Test: `src/ui/art/portrait.test.ts`, `src/ui/art/texture.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/art/portrait.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { portraitFor } from './portrait'

const NAMES = ['Ada', 'Bram', 'Cora', 'Dev', 'Elsa', 'Finn', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lena']

describe('portraitFor', () => {
  it('is deterministic for a name', () => {
    expect(portraitFor('Ada')).toEqual(portraitFor('Ada'))
  })

  it('gives different people different faces', () => {
    const faces = new Set(NAMES.map((name) => JSON.stringify(portraitFor(name))))
    expect(faces.size).toBe(NAMES.length)
  })

  it('draws a background, shoulders, a face and hair', () => {
    for (const name of NAMES) {
      const { shapes } = portraitFor(name)
      expect(shapes.length).toBeGreaterThanOrEqual(5)
      expect(shapes[0].kind).toBe('rect')
    }
  })

  it('uses only plain drawing data', () => {
    for (const shape of portraitFor('Ada').shapes) expect(['rect', 'ellipse', 'path']).toContain(shape.kind)
  })
})
```

Create `src/ui/art/texture.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { roomSurface } from './texture'

describe('roomSurface', () => {
  it('is stable for a room', () => {
    expect(roomSurface(3)).toEqual(roomSurface(3))
  })

  it('gives the first eight rooms different looks', () => {
    const looks = new Set(Array.from({ length: 8 }, (_, room) => JSON.stringify(roomSurface(room))))
    expect(looks.size).toBe(8)
  })

  it('paints a tiling svg background', () => {
    const surface = roomSurface(0)
    expect(surface.backgroundImage).toContain('data:image/svg+xml')
    expect(surface.backgroundColor).toMatch(/^hsl\(/)
    expect(surface.backgroundSize).toBe('24px 24px')
  })

  it('keeps working past the number of patterns', () => {
    expect(roomSurface(15).backgroundImage).toContain('data:image/svg+xml')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/art`
Expected: FAIL, cannot resolve `./portrait` and `./texture`.

- [ ] **Step 3: Implement**

Create `src/ui/art/portrait.ts`:

```ts
import type { SpriteDef, SpriteShape } from '../../engine/plugin'
import { hashSeed, mulberry32, pick } from '../../engine/rng'

const INK = '#1f2430'
const BACKGROUNDS = ['#a85d4a', '#4f8a5b', '#5aa5b0', '#5d6bb0', '#7a4f8f', '#d89a9a', '#c9a24a', '#6b7f99']
const SKINS = ['#fbd9bd', '#f2c6a0', '#e0a878', '#c68a5c', '#a8693f', '#7a4a2c']
const HAIRS = ['#2b1d16', '#5a3825', '#8a5a2b', '#d9b24c', '#b8b8c0', '#c1442e', '#1c1c24']
const SHIRTS = ['#e0872e', '#9b6bc9', '#3f7fbf', '#d95f7a', '#4fa68a', '#c9b04a', '#8a8fa8', '#d8d8e0']

const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'bald'] as const

const shape = (s: SpriteShape): SpriteShape => s

/** A faceless flat portrait, derived entirely from the name so every theme gets faces for free. */
export function portraitFor(name: string): SpriteDef {
  const rng = mulberry32(hashSeed(`portrait:${name}`))
  const background = pick(rng, BACKGROUNDS)
  const skin = pick(rng, SKINS)
  const hair = pick(rng, HAIRS)
  const shirt = pick(rng, SHIRTS)
  const style = pick(rng, HAIR_STYLES)
  const beard = style !== 'long' && rng() < 0.3

  const shapes: SpriteShape[] = [
    shape({ kind: 'rect', x: 0, y: 0, w: 100, h: 100, fill: background }),
  ]
  if (style === 'long') {
    shapes.push(
      shape({ kind: 'path', d: 'M24 56 C20 18 36 8 50 8 C64 8 80 18 76 56 L78 80 L22 80 Z', fill: hair, stroke: INK, sw: 3 }),
    )
  }
  shapes.push(
    shape({ kind: 'path', d: 'M8 100 C8 78 28 70 50 70 C72 70 92 78 92 100 Z', fill: shirt, stroke: INK, sw: 3 }),
    shape({ kind: 'rect', x: 43, y: 58, w: 14, h: 18, fill: skin, stroke: INK, sw: 3 }),
    shape({ kind: 'ellipse', cx: 50, cy: 42, rx: 20, ry: 24, fill: skin, stroke: INK, sw: 3 }),
    shape({ kind: 'path', d: 'M50 18 A20 24 0 0 1 50 66 Z', fill: 'rgba(0,0,0,0.1)' }),
  )
  if (beard) {
    shapes.push(shape({ kind: 'path', d: 'M31 46 C33 72 67 72 69 46 C62 58 38 58 31 46 Z', fill: hair, stroke: INK, sw: 3 }))
  }
  if (style === 'short' || style === 'long' || style === 'bun') {
    shapes.push(
      shape({
        kind: 'path',
        d: 'M29 38 C26 16 40 9 52 9 C66 9 75 20 71 40 C65 29 55 25 45 27 C38 29 32 33 29 38 Z',
        fill: hair,
        stroke: INK,
        sw: 3,
      }),
    )
  }
  if (style === 'bun') shapes.push(shape({ kind: 'ellipse', cx: 50, cy: 7, rx: 10, ry: 8, fill: hair, stroke: INK, sw: 3 }))
  if (style === 'curly') {
    for (const [cx, cy, r] of [[34, 22, 11], [48, 14, 12], [63, 20, 12], [72, 32, 9], [28, 34, 8]] as const) {
      shapes.push(shape({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill: hair, stroke: INK, sw: 3 }))
    }
  }
  return { shapes }
}
```

Create `src/ui/art/texture.ts`:

```ts
import type { CSSProperties } from 'react'
import { roomHue } from '../palette'

const TILE = 24

const PATTERNS: readonly ((ink: string) => string)[] = [
  (ink) => `<path d="M8 0V24M16 0V24" stroke="${ink}" stroke-width="1"/>`,
  (ink) => `<rect width="12" height="12" fill="${ink}"/><rect x="12" y="12" width="12" height="12" fill="${ink}"/>`,
  (ink) => `<path d="M0 8Q6 2 12 8T24 8M0 20Q6 14 12 20T24 20" fill="none" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) =>
    `<rect x="1" y="1" width="10" height="10" rx="4" fill="none" stroke="${ink}"/><rect x="13" y="13" width="10" height="10" rx="4" fill="none" stroke="${ink}"/>`,
  (ink) => `<path d="M4 8L6 3M14 20L16 15M19 9L21 4M8 22L10 17" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) => `<path d="M0 12H24M12 0V24" stroke="${ink}" stroke-width="1"/>`,
  (ink) => `<path d="M0 24L24 0M-6 6L6 -6M18 30L30 18" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) => `<circle cx="6" cy="6" r="1.8" fill="${ink}"/><circle cx="18" cy="18" r="1.8" fill="${ink}"/>`,
]

/** Background of a board cell for a room: a flat color plus a tiling pattern, so rooms differ by more than hue. */
export function roomSurface(room: number): CSSProperties {
  const hue = roomHue(room)
  const ink = `hsl(${hue} 40% 70%)`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">${PATTERNS[room % PATTERNS.length](ink)}</svg>`
  return {
    backgroundColor: `hsl(${hue} 55% 87%)`,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${TILE}px ${TILE}px`,
  }
}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add generated portraits and room textures"
```

---

### Task 5: Board: strokes, tokens, crosses and sprites

The board turns pointer positions into cells (`cellAt`) and drags into gap-free strokes (`lineCells`), previews the stroke while dragging, and commits it as one `onStroke` call. The first cell decides the mode through the active tool's `paint` rule; blocked cells are skipped. Keyboard users get the same tools through clicks with `detail === 0`. Placed suspects show portrait tokens, marked cells show a cross.

**Files:**
- Create: `src/ui/boardGeometry.ts`
- Modify: `src/ui/Board.tsx`, `src/ui/Game.tsx`
- Test: `src/ui/boardGeometry.test.ts`, `src/ui/Board.test.tsx`, `src/ui/Game.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/Board.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tiny } from '../engine/fixtures'
import type { PaintMode, ToolDef } from '../engine/plugin'
import type { Pos } from '../engine/types'
import { Board } from './Board'

afterEach(cleanup)

const X: ToolDef = { id: 'x', label: 'Mark', paint: ({ marked }) => (marked ? 'unmark' : 'mark') }
const ERASER: ToolDef = { id: 'eraser', label: 'Eraser', paint: () => 'erase' }
const SELECT: ToolDef = { id: 'select', label: 'Select' }

// A 4 x 4 board drawn 400px wide at the origin: every cell is 100px, so cell (r, c) centers at (100c + 50, 100r + 50).
const center = (r: number, c: number) => ({ clientX: c * 100 + 50, clientY: r * 100 + 50 })

function setup(options: { tool?: ToolDef; marks?: string[]; placements?: Record<number, Pos> } = {}) {
  const onStroke = vi.fn<(cells: Pos[], mode: PaintMode) => void>()
  const onCellClick = vi.fn<(pos: Pos) => void>()
  render(
    <Board
      puzzle={tiny}
      placements={options.placements ?? {}}
      marks={new Set(options.marks ?? [])}
      selected={null}
      conflicts={new Set()}
      tool={options.tool ?? X}
      onCellClick={onCellClick}
      onStroke={onStroke}
    />,
  )
  const grid = screen.getByRole('grid')
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
  const down = (r: number, c: number) => fireEvent.pointerDown(grid, { ...center(r, c), pointerId: 1, button: 0 })
  const move = (r: number, c: number) => fireEvent.pointerMove(grid, { ...center(r, c), pointerId: 1 })
  const up = (r: number, c: number) => fireEvent.pointerUp(grid, { ...center(r, c), pointerId: 1 })
  return { grid, onStroke, onCellClick, down, move, up }
}

describe('Board strokes', () => {
  it('marks every cell of a dragged row in one stroke', () => {
    const { onStroke, down, move, up } = setup()
    down(0, 0)
    move(0, 1)
    move(0, 2)
    move(0, 3)
    up(0, 3)
    expect(onStroke).toHaveBeenCalledTimes(1)
    expect(onStroke).toHaveBeenCalledWith(
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
        { r: 0, c: 3 },
      ],
      'mark',
    )
  })

  it('fills the cells a fast drag jumps over', () => {
    const { onStroke, down, move, up } = setup()
    down(0, 0)
    move(0, 3)
    up(0, 3)
    expect(onStroke.mock.calls[0][0]).toHaveLength(4)
  })

  it('removes marks when the stroke starts on a marked cell', () => {
    const { onStroke, down, move, up } = setup({ marks: ['0,1'] })
    down(0, 1)
    move(0, 2)
    up(0, 2)
    expect(onStroke).toHaveBeenCalledWith(
      [
        { r: 0, c: 1 },
        { r: 0, c: 2 },
      ],
      'unmark',
    )
  })

  it('skips blocked cells', () => {
    const { onStroke, down, move, up } = setup()
    down(1, 0)
    move(1, 3)
    up(1, 3)
    const cells = onStroke.mock.calls[0][0]
    expect(cells).toEqual([
      { r: 1, c: 0 },
      { r: 1, c: 2 },
      { r: 1, c: 3 },
    ])
  })

  it('erases with the eraser tool', () => {
    const { onStroke, down, up } = setup({ tool: ERASER })
    down(2, 3)
    up(2, 3)
    expect(onStroke).toHaveBeenCalledWith([{ r: 2, c: 3 }], 'erase')
  })

  it('discards a cancelled stroke', () => {
    const { grid, onStroke, down, move } = setup()
    down(0, 0)
    move(0, 2)
    fireEvent.pointerCancel(grid, { pointerId: 1 })
    expect(onStroke).not.toHaveBeenCalled()
  })

  it('previews the stroke before it is committed', () => {
    const { down, move } = setup()
    down(0, 0)
    move(0, 1)
    expect(screen.getByTestId('cell-0-1')).toHaveClass('stroke-mark')
    expect(screen.getByTestId('cell-0-2')).not.toHaveClass('stroke-mark')
  })

  it('does nothing on pointer drags with the select tool', () => {
    const { onStroke, down, move, up } = setup({ tool: SELECT })
    down(0, 0)
    move(0, 3)
    up(0, 3)
    expect(onStroke).not.toHaveBeenCalled()
  })
})

describe('Board clicks', () => {
  it('forwards a mouse click to onCellClick with the select tool', () => {
    const { onCellClick } = setup({ tool: SELECT })
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 1 })
    expect(onCellClick).toHaveBeenCalledWith({ r: 0, c: 1 })
  })

  it('applies a stroke tool to a single cell on a keyboard click', () => {
    const { onStroke, onCellClick } = setup()
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 0 })
    expect(onStroke).toHaveBeenCalledWith([{ r: 0, c: 1 }], 'mark')
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('ignores clicks on blocked cells', () => {
    const { onCellClick } = setup({ tool: SELECT })
    fireEvent.click(screen.getByTestId('cell-1-1'), { detail: 1 })
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('ignores the mouse click that follows a pointer stroke', () => {
    const { onStroke } = setup()
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 1 })
    expect(onStroke).not.toHaveBeenCalled()
  })
})

describe('Board contents', () => {
  it('shows a portrait token and names the occupant', () => {
    setup({ placements: { 1: { r: 0, c: 1 } } })
    const cell = screen.getByTestId('cell-0-1')
    expect(cell).toHaveAttribute('data-occupant', '1')
    expect(cell).toHaveAccessibleName(/Bob/)
    expect(cell.querySelector('.token svg')).not.toBeNull()
  })

  it('shows a cross on marked empty cells only', () => {
    setup({ marks: ['0,2', '0,1'], placements: { 1: { r: 0, c: 1 } } })
    expect(screen.getByTestId('cell-0-2')).toHaveAttribute('data-marked', 'true')
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-marked')
  })

  it('draws a sprite on cells with objects and marks blocking ones as unavailable', () => {
    setup()
    expect(screen.getByTestId('cell-1-1').querySelector('svg.sprite')).not.toBeNull()
    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('cell-1-0')).not.toHaveAttribute('aria-disabled')
  })
})
```

Edit `src/ui/Game.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.test.tsx b/src/ui/Game.test.tsx
index 0c57d68..2a96203 100644
--- a/src/ui/Game.test.tsx
+++ b/src/ui/Game.test.tsx
@@ -37,10 +37,10 @@ describe('Game', () => {
     renderGame(fakeStorage())
     await place(user, 0, 0, 1)
-    expect(screen.getByTestId('cell-0-1')).toHaveTextContent('A')
+    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
   })
 
   it('does not allow blocking cells', () => {
     renderGame(fakeStorage())
-    expect(screen.getByTestId('cell-1-1')).toBeDisabled()
+    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
   })
 
@@ -58,5 +58,5 @@ describe('Game', () => {
     renderGame(fakeStorage())
     await user.click(screen.getByTestId('cell-2-3'))
-    expect(screen.getByTestId('cell-2-3')).toHaveTextContent('x')
+    expect(screen.getByTestId('cell-2-3')).toHaveAttribute('data-marked', 'true')
   })
 
@@ -105,5 +105,5 @@ describe('Game', () => {
     first.unmount()
     renderGame(storage)
-    expect(screen.getByTestId('cell-0-1')).toHaveTextContent('A')
+    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
   })
 
@@ -115,5 +115,5 @@ describe('Game', () => {
     first.unmount()
     render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="b" storage={storage} now={() => 1_000_000} />)
-    expect(screen.getByTestId('cell-0-1')).not.toHaveTextContent('A')
+    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
   })
 })
```

Create `src/ui/boardGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cellAt, lineCells } from './boardGeometry'

const rect = { left: 100, top: 50, width: 400, height: 400 }

describe('cellAt', () => {
  it('maps a point to the cell under it', () => {
    expect(cellAt(rect, 4, 101, 51)).toEqual({ r: 0, c: 0 })
    expect(cellAt(rect, 4, 499, 449)).toEqual({ r: 3, c: 3 })
    expect(cellAt(rect, 4, 250, 160)).toEqual({ r: 1, c: 1 })
  })

  it('returns null outside the board', () => {
    expect(cellAt(rect, 4, 99, 100)).toBeNull()
    expect(cellAt(rect, 4, 200, 49)).toBeNull()
    expect(cellAt(rect, 4, 500, 100)).toBeNull()
    expect(cellAt(rect, 4, 200, 450)).toBeNull()
  })
})

describe('lineCells', () => {
  it('returns just the cell when both ends match', () => {
    expect(lineCells({ r: 2, c: 2 }, { r: 2, c: 2 })).toEqual([{ r: 2, c: 2 }])
  })

  it('walks a row in order, in both directions', () => {
    expect(lineCells({ r: 1, c: 0 }, { r: 1, c: 3 }).map((p) => p.c)).toEqual([0, 1, 2, 3])
    expect(lineCells({ r: 1, c: 3 }, { r: 1, c: 0 }).map((p) => p.c)).toEqual([3, 2, 1, 0])
  })

  it('walks a diagonal without gaps', () => {
    expect(lineCells({ r: 0, c: 0 }, { r: 3, c: 3 })).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 1 },
      { r: 2, c: 2 },
      { r: 3, c: 3 },
    ])
  })

  it('never skips a row or column on a shallow line', () => {
    const cells = lineCells({ r: 0, c: 0 }, { r: 2, c: 7 })
    expect(cells[0]).toEqual({ r: 0, c: 0 })
    expect(cells[cells.length - 1]).toEqual({ r: 2, c: 7 })
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i].r - cells[i - 1].r)).toBeLessThanOrEqual(1)
      expect(Math.abs(cells[i].c - cells[i - 1].c)).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/boardGeometry.test.ts src/ui/Board.test.tsx`
Expected: FAIL, cannot resolve `./boardGeometry`, and the old board has no strokes, tokens or `data-marked`.

- [ ] **Step 3: Implement**

Replace the whole of `src/ui/Board.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { PaintMode, ToolDef } from '../engine/plugin'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { posKey } from '../state/reducer'
import { spriteFor } from './art/lookup'
import { portraitFor } from './art/portrait'
import { Sprite } from './art/Sprite'
import { roomSurface } from './art/texture'
import { cellAt, lineCells } from './boardGeometry'

interface BoardProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  marks: ReadonlySet<string>
  selected: number | null
  conflicts: ReadonlySet<string>
  tool: ToolDef | undefined
  gridRef?: RefObject<HTMLDivElement | null>
  onCellClick: (pos: Pos) => void
  onStroke: (cells: Pos[], mode: PaintMode) => void
}

interface Stroke {
  mode: PaintMode
  cells: Pos[]
}

const THICK = 'var(--wall-thick)'
const THIN = 'var(--wall-thin)'

export function Board({ puzzle, placements, marks, selected, conflicts, tool, gridRef, onCellClick, onStroke }: BoardProps) {
  const strokeRef = useRef<Stroke | null>(null)
  const [preview, setPreview] = useState<Stroke | null>(null)
  const paint = tool?.paint

  const occupantAt = new Map<string, number>()
  for (const [suspect, pos] of Object.entries(placements)) occupantAt.set(posKey(pos), Number(suspect))

  const labelAt = new Map<string, string>()
  puzzle.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const seenAbove = puzzle.cells.slice(0, r).some((above) => above.some((x) => x.room === cell.room))
      if (!seenAbove && !row.slice(0, c).some((x) => x.room === cell.room)) {
        labelAt.set(posKey({ r, c }), puzzle.rooms[cell.room])
      }
    }),
  )

  const modeAt = (pos: Pos): PaintMode | null => {
    const key = posKey(pos)
    return paint ? paint({ marked: marks.has(key), occupied: occupantAt.has(key) }) : null
  }

  const setStroke = (next: Stroke | null) => {
    strokeRef.current = next
    setPreview(next)
  }

  const locate = (e: PointerEvent<HTMLDivElement>) =>
    cellAt(e.currentTarget.getBoundingClientRect(), puzzle.size, e.clientX, e.clientY)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!paint || (e.pointerType === 'mouse' && e.button !== 0)) return
    const pos = locate(e)
    const mode = pos && modeAt(pos)
    if (!pos || !mode) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setStroke({ mode, cells: [pos] })
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current
    const pos = stroke && locate(e)
    if (!stroke || !pos) return
    const last = stroke.cells[stroke.cells.length - 1]
    if (pos.r === last.r && pos.c === last.c) return
    const fresh = lineCells(last, pos)
      .slice(1)
      .filter((p) => !stroke.cells.some((q) => q.r === p.r && q.c === p.c))
    if (fresh.length > 0) setStroke({ ...stroke, cells: [...stroke.cells, ...fresh] })
  }

  const onPointerUp = () => {
    const stroke = strokeRef.current
    setStroke(null)
    if (!stroke) return
    const cells = stroke.cells.filter((p) => isOccupiable(puzzle.cells[p.r][p.c]))
    if (cells.length > 0) onStroke(cells, stroke.mode)
  }

  const previewing = new Set(preview?.cells.map(posKey))

  return (
    <div
      ref={gridRef}
      className={`board${paint ? ' stroking' : ''}`}
      style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      role="grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setStroke(null)}
    >
      {puzzle.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const pos = { r, c }
          const key = posKey(pos)
          const occupant = occupantAt.get(key)
          const differs = (nr: number, nc: number) => puzzle.cells[nr]?.[nc]?.room !== cell.room
          const blocked = !isOccupiable(cell)
          const marked = marks.has(key) && occupant === undefined
          const occupantName = occupant === undefined ? '' : `, ${puzzle.suspects[occupant].name}`
          const label = `Row ${r + 1}, column ${c + 1}, ${puzzle.rooms[cell.room]}${cell.object ? `, ${cell.object}` : ''}${occupantName}`
          const classes = [
            'cell',
            conflicts.has(key) ? 'conflict' : '',
            selected !== null && occupant === selected ? 'picked' : '',
            previewing.has(key) && preview ? `stroke-${preview.mode}` : '',
          ]
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-testid={`cell-${r}-${c}`}
              data-occupant={occupant}
              data-marked={marked ? 'true' : undefined}
              aria-label={label}
              aria-disabled={blocked || undefined}
              className={classes.filter(Boolean).join(' ')}
              style={{
                ...roomSurface(cell.room),
                borderTop: differs(r - 1, c) ? THICK : THIN,
                borderBottom: differs(r + 1, c) ? THICK : THIN,
                borderLeft: differs(r, c - 1) ? THICK : THIN,
                borderRight: differs(r, c + 1) ? THICK : THIN,
              }}
              onClick={(e) => {
                if (blocked) return
                if (!paint) return onCellClick(pos)
                const mode = e.detail === 0 ? modeAt(pos) : null
                if (mode) onStroke([pos], mode)
              }}
            >
              {labelAt.has(key) && <span className="room-label">{labelAt.get(key)}</span>}
              {cell.object && <Sprite sprite={spriteFor(puzzle, cell.object)} className="sprite" />}
              {marked && (
                <svg className="mark" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M22 22L78 78M78 22L22 78" />
                </svg>
              )}
              {occupant !== undefined && (
                <span className="token">
                  <Sprite sprite={portraitFor(puzzle.suspects[occupant].name)} />
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
```

Edit `src/ui/Game.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.tsx b/src/ui/Game.tsx
index c0d44e5..9b48a0e 100644
--- a/src/ui/Game.tsx
+++ b/src/ui/Game.tsx
@@ -1,4 +1,5 @@
 import { useEffect, useMemo, useReducer, useState } from 'react'
 import { answerOf, evaluate, isLegalPlacement, isSolved } from '../engine/clues'
+import { registry } from '../engine/registry'
 import { isOccupiable } from '../engine/types'
 import type { Pos, Puzzle } from '../engine/types'
@@ -47,5 +48,5 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
   const [check, setCheck] = useState<{ key: string; failing: number[] } | null>(null)
 
-  const { progress, selected } = game
+  const { progress, selected, tool } = game
   const solved = progress.solvedAt !== null
 
@@ -145,5 +146,7 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
         selected={selected}
         conflicts={conflicts}
+        tool={registry.tools().find((t) => t.id === tool)}
         onCellClick={onCellClick}
+        onStroke={(cells, mode) => dispatch({ type: 'paint', cells, mode })}
       />
 
```

Create `src/ui/boardGeometry.ts`:

```ts
import type { Pos } from '../engine/types'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export function cellAt(box: Box, size: number, x: number, y: number): Pos | null {
  const c = Math.floor(((x - box.left) / box.width) * size)
  const r = Math.floor(((y - box.top) / box.height) * size)
  return r >= 0 && c >= 0 && r < size && c < size ? { r, c } : null
}

/** Every cell on the straight line from `from` to `to`, both ends included (Bresenham). */
export function lineCells(from: Pos, to: Pos): Pos[] {
  const cells: Pos[] = []
  const dr = Math.abs(to.r - from.r)
  const dc = Math.abs(to.c - from.c)
  const stepR = from.r < to.r ? 1 : -1
  const stepC = from.c < to.c ? 1 : -1
  let err = dc - dr
  let { r, c } = from
  for (;;) {
    cells.push({ r, c })
    if (r === to.r && c === to.c) return cells
    const doubled = 2 * err
    if (doubled > -dr) {
      err -= dr
      c += stepC
    }
    if (doubled < dc) {
      err += dc
      r += stepR
    }
  }
}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add stroke painting, portrait tokens and crosses to the board"
```

---

### Task 6: Suspect cards with clues and drag-to-place

One card per suspect: portrait, handwritten name plate and the suspect's clue on an attached card. Click selects; the clue card crosses the clue out. Pressing a card and moving more than 6px starts a drag with a ghost portrait; releasing over an occupiable cell calls `onDrop`, and the click that follows is swallowed.

**Files:**
- Create: `src/ui/SuspectPanel.tsx`
- Test: `src/ui/SuspectPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/SuspectPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tiny } from '../engine/fixtures'
import type { Pos } from '../engine/types'
import { SuspectPanel } from './SuspectPanel'

afterEach(cleanup)

// The board is 400px wide at the origin, so cell (r, c) spans [100c, 100c + 100) x [100r, 100r + 100).
function setup(options: { placements?: Record<number, Pos>; selected?: number | null; struck?: number[]; failing?: number[] } = {}) {
  const board = document.createElement('div')
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
  const onSelect = vi.fn()
  const onToggleStrike = vi.fn()
  const onDrop = vi.fn()
  render(
    <SuspectPanel
      puzzle={tiny}
      placements={options.placements ?? {}}
      selected={options.selected ?? null}
      struck={options.struck ?? []}
      failing={new Set(options.failing ?? [])}
      boardRef={{ current: board }}
      onSelect={onSelect}
      onToggleStrike={onToggleStrike}
      onDrop={onDrop}
    />,
  )
  return { onSelect, onToggleStrike, onDrop }
}

const drag = (card: HTMLElement, to: { x: number; y: number }) => {
  fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
  fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
}

describe('SuspectPanel cards', () => {
  it('shows a portrait, the name and the clue for every suspect', () => {
    setup()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByTestId('suspect-1')).toHaveTextContent('Bob')
    expect(screen.getByTestId('suspect-1').querySelector('.portrait svg')).not.toBeNull()
    expect(screen.getByTestId('clue-1')).toHaveTextContent('Bob was sitting on a chair.')
    expect(screen.getByTestId('suspect-0')).toHaveTextContent('(victim)')
    expect(screen.getByTestId('clue-0')).toHaveTextContent('Ann was alone with the killer.')
  })

  it('selects a suspect on click and deselects on a second click', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByTestId('suspect-2'))
    expect(onSelect).toHaveBeenLastCalledWith(2)
    cleanup()
    const again = setup({ selected: 2 })
    fireEvent.click(screen.getByTestId('suspect-2'))
    expect(again.onSelect).toHaveBeenLastCalledWith(null)
  })

  it('reflects selected, placed, struck and failing states', () => {
    setup({ selected: 1, placements: { 2: { r: 0, c: 0 } }, struck: [3], failing: [1] })
    expect(screen.getByTestId('suspect-1')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('suspect-2').closest('li')).toHaveClass('placed')
    expect(screen.getByTestId('clue-3')).toHaveClass('struck')
    expect(screen.getByTestId('clue-1')).toHaveClass('failing')
  })

  it('toggles the strike on a clue card', () => {
    const { onToggleStrike } = setup()
    fireEvent.click(screen.getByTestId('clue-2'))
    expect(onToggleStrike).toHaveBeenCalledWith(2)
  })
})

describe('SuspectPanel dragging', () => {
  it('drops a dragged suspect on the cell under the pointer without selecting it', () => {
    const { onDrop, onSelect } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 150, y: 250 })
    fireEvent.click(card)
    expect(onDrop).toHaveBeenCalledWith(1, { r: 2, c: 1 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a ghost portrait while dragging and removes it on release', () => {
    setup()
    const card = screen.getByTestId('suspect-1')
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 250, pointerId: 1 })
    expect(document.querySelector('.ghost')).not.toBeNull()
    fireEvent.pointerUp(window, { clientX: 150, clientY: 250, pointerId: 1 })
    expect(document.querySelector('.ghost')).toBeNull()
  })

  it('does nothing when released outside the board or on a blocked cell', () => {
    const { onDrop } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 700, y: 700 })
    drag(card, { x: 150, y: 150 })
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('treats a tiny movement as a click', () => {
    const { onDrop, onSelect } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 8, y: 8 })
    fireEvent.click(card)
    expect(onDrop).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/SuspectPanel.test.tsx`
Expected: FAIL, cannot resolve `./SuspectPanel`.

- [ ] **Step 3: Implement**

Create `src/ui/SuspectPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { renderClue } from '../engine/clues'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { portraitFor } from './art/portrait'
import { Sprite } from './art/Sprite'
import { cellAt } from './boardGeometry'

interface SuspectPanelProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  selected: number | null
  struck: readonly number[]
  failing: ReadonlySet<number>
  boardRef: RefObject<HTMLDivElement | null>
  onSelect: (suspect: number | null) => void
  onToggleStrike: (suspect: number) => void
  onDrop: (suspect: number, pos: Pos) => void
}

interface Ghost {
  suspect: number
  x: number
  y: number
}

const DRAG_THRESHOLD = 6

export function SuspectPanel({
  puzzle,
  placements,
  selected,
  struck,
  failing,
  boardRef,
  onSelect,
  onToggleStrike,
  onDrop,
}: SuspectPanelProps) {
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragged = useRef(false)
  const stopDrag = useRef<(() => void) | null>(null)

  useEffect(() => () => stopDrag.current?.(), [])

  const beginDrag = (e: PointerEvent<HTMLElement>, suspect: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopDrag.current?.()
    const origin = { x: e.clientX, y: e.clientY }
    dragged.current = false

    const move = (ev: globalThis.PointerEvent) => {
      if (!dragged.current && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD) return
      dragged.current = true
      setGhost({ suspect, x: ev.clientX, y: ev.clientY })
    }
    const end = (ev: globalThis.PointerEvent) => {
      stop()
      if (!dragged.current || ev.type === 'pointercancel') return
      const box = boardRef.current?.getBoundingClientRect()
      const pos = box && cellAt(box, puzzle.size, ev.clientX, ev.clientY)
      if (pos && isOccupiable(puzzle.cells[pos.r][pos.c])) onDrop(suspect, pos)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      stopDrag.current = null
      setGhost(null)
    }
    stopDrag.current = stop
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <>
      <ul className="suspects" aria-label="Suspects">
        {puzzle.suspects.map((suspect, i) => (
          <li
            key={suspect.name}
            className={`card${placements[i] ? ' placed' : ''}${i === puzzle.victim ? ' victim' : ''}`}
          >
            <button
              type="button"
              data-testid={`suspect-${i}`}
              className="portrait-card"
              aria-pressed={selected === i}
              onPointerDown={(e) => beginDrag(e, i)}
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false
                  return
                }
                onSelect(selected === i ? null : i)
              }}
            >
              <span className="portrait">
                <Sprite sprite={portraitFor(suspect.name)} />
              </span>
              <span className="plate">
                {suspect.name}
                {i === puzzle.victim && <small> (victim)</small>}
              </span>
            </button>
            <button
              type="button"
              data-testid={`clue-${i}`}
              className={`clue-card${struck.includes(i) ? ' struck' : ''}${failing.has(i) ? ' failing' : ''}`}
              aria-pressed={struck.includes(i)}
              title="Click to cross out this clue"
              onClick={() => onToggleStrike(i)}
            >
              {puzzle.clues
                .filter((clue) => clue.suspect === i)
                .map((clue) => renderClue(clue, puzzle))
                .join(' ')}
            </button>
          </li>
        ))}
      </ul>
      {ghost && (
        <div className="ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <Sprite sprite={portraitFor(puzzle.suspects[ghost.suspect].name)} />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add suspect cards with clue cards and drag-to-place"
```

---

### Task 7: Tools panel, the new game shell and the visual language

`ToolsPanel` lists the stroke tools (select is implicit: picking a card returns to it), Undo, Hint, Submit and How to play, and clears the board when the eraser is held for 800 ms. `Game` becomes the three-column shell; Submit runs the check and only then reveals the accusation, so the arrangement is not given away early. The CSS implements the spec's visual language and the fonts are bundled for offline play.

**Files:**
- Create: `src/ui/ToolsPanel.tsx`
- Modify: `src/ui/Game.tsx`, `src/index.css`, `src/main.tsx`, `vite.config.ts`, `package.json`, `tests/e2e/solve.spec.ts`
- Delete: `src/ui/SuspectTray.tsx`, `src/ui/CluePanel.tsx`, `src/ui/Legend.tsx`
- Test: `src/ui/ToolsPanel.test.tsx`, `src/ui/Game.test.tsx`

- [ ] **Step 1: Write the failing tests**

Edit `src/ui/Game.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.test.tsx b/src/ui/Game.test.tsx
index 2a96203..d4596c3 100644
--- a/src/ui/Game.test.tsx
+++ b/src/ui/Game.test.tsx
@@ -1,11 +1,15 @@
 // @vitest-environment jsdom
-import { cleanup, render, screen } from '@testing-library/react'
+import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
 import userEvent from '@testing-library/user-event'
-import { afterEach, describe, expect, it } from 'vitest'
+import { afterEach, describe, expect, it, vi } from 'vitest'
 import { pairs, tiny } from '../engine/fixtures'
 import { loadState, STORAGE_KEY } from '../state/storage'
 import { Game } from './Game'
 
-afterEach(cleanup)
+afterEach(() => {
+  cleanup()
+  vi.useRealTimers()
+  vi.restoreAllMocks()
+})
 
 function fakeStorage() {
@@ -64,5 +68,5 @@ describe('Game', () => {
     const user = userEvent.setup()
     renderGame(fakeStorage())
-    await user.click(screen.getByRole('button', { name: 'Check' }))
+    await user.click(screen.getByRole('button', { name: 'Hint' }))
     expect(screen.getByRole('status')).toHaveTextContent('Place every suspect')
   })
@@ -75,5 +79,5 @@ describe('Game', () => {
     await place(user, 2, 2, 3)
     await place(user, 3, 3, 0)
-    await user.click(screen.getByRole('button', { name: 'Check' }))
+    await user.click(screen.getByRole('button', { name: 'Hint' }))
     expect(screen.getByRole('status')).toHaveTextContent('contradict their clues')
     expect(screen.getByTestId('clue-1')).toHaveClass('failing')
@@ -85,4 +89,6 @@ describe('Game', () => {
     renderGame(storage)
     await placeSolution(user)
+    expect(screen.queryByTestId('accuse-1')).toBeNull()
+    await user.click(screen.getByRole('button', { name: /Submit/ }))
 
     await user.click(screen.getByTestId('accuse-2'))
@@ -117,3 +123,112 @@ describe('Game', () => {
     expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
   })
+
+  it('keeps submit disabled until every suspect is placed', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
+    await placeSolution(user)
+    expect(screen.getByRole('button', { name: /Submit/ })).toBeEnabled()
+  })
+
+  it('undoes the last placement', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
+    await place(user, 0, 0, 1)
+    await user.click(screen.getByRole('button', { name: 'Undo' }))
+    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
+  })
+
+  it('shows the rules on demand', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull()
+    await user.click(screen.getByRole('button', { name: 'How to play' }))
+    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument()
+  })
+})
+
+describe('Game tools', () => {
+  // The board is 400px wide at the origin, so cell (r, c) centers at (100c + 50, 100r + 50).
+  const mockBoard = () => {
+    const grid = screen.getByRole('grid')
+    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
+    return grid
+  }
+  const stroke = (grid: HTMLElement, from: [number, number], to: [number, number]) => {
+    const at = ([r, c]: [number, number]) => ({ clientX: c * 100 + 50, clientY: r * 100 + 50, pointerId: 1 })
+    fireEvent.pointerDown(grid, { ...at(from), button: 0 })
+    fireEvent.pointerMove(grid, at(to))
+    fireEvent.pointerUp(grid, at(to))
+  }
+
+  it('crosses out a dragged row with the X tool and undoes it in one step', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    const grid = mockBoard()
+    await user.click(screen.getByTestId('tool-x'))
+    stroke(grid, [0, 0], [0, 3])
+    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).toHaveAttribute('data-marked', 'true')
+    await user.click(screen.getByRole('button', { name: 'Undo' }))
+    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).not.toHaveAttribute('data-marked')
+  })
+
+  it('removes a suspect and a cross with the eraser', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    const grid = mockBoard()
+    await place(user, 0, 0, 1)
+    await user.click(screen.getByTestId('tool-x'))
+    stroke(grid, [0, 3], [0, 3])
+    await user.click(screen.getByTestId('tool-eraser'))
+    stroke(grid, [0, 1], [0, 3])
+    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
+    expect(screen.getByTestId('cell-0-3')).not.toHaveAttribute('data-marked')
+  })
+
+  it('goes back to placing suspects when a card is picked', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    await user.click(screen.getByTestId('tool-x'))
+    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'true')
+    await user.click(screen.getByTestId('suspect-0'))
+    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'false')
+    await user.click(screen.getByTestId('cell-0-1'))
+    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
+  })
+
+  it('places a suspect dragged from its card onto the board', () => {
+    renderGame(fakeStorage())
+    mockBoard()
+    const card = screen.getByTestId('suspect-2')
+    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
+    fireEvent.pointerMove(window, { clientX: 350, clientY: 250, pointerId: 1 })
+    fireEvent.pointerUp(window, { clientX: 350, clientY: 250, pointerId: 1 })
+    expect(screen.getByTestId('cell-2-3')).toHaveAttribute('data-occupant', '2')
+  })
+
+  it('clears the board when the eraser is held and the player confirms', async () => {
+    vi.useFakeTimers()
+    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
+    renderGame(fakeStorage())
+    fireEvent.click(screen.getByTestId('suspect-0'))
+    fireEvent.click(screen.getByTestId('cell-0-1'))
+    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
+    fireEvent.pointerDown(screen.getByTestId('tool-eraser'))
+    act(() => vi.advanceTimersByTime(900))
+    expect(confirm).toHaveBeenCalled()
+    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
+  })
+
+  it('keeps the board when the player declines to clear it', () => {
+    vi.useFakeTimers()
+    vi.spyOn(window, 'confirm').mockReturnValue(false)
+    renderGame(fakeStorage())
+    fireEvent.click(screen.getByTestId('suspect-0'))
+    fireEvent.click(screen.getByTestId('cell-0-1'))
+    fireEvent.pointerDown(screen.getByTestId('tool-eraser'))
+    act(() => vi.advanceTimersByTime(900))
+    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
+  })
 })
```

Create `src/ui/ToolsPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolDef } from '../engine/plugin'
import { ToolsPanel } from './ToolsPanel'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'x', label: 'Mark', paint: () => 'mark' },
  { id: 'eraser', label: 'Eraser', paint: () => 'erase', holdToClear: true },
]

function setup(overrides: Partial<Parameters<typeof ToolsPanel>[0]> = {}) {
  const handlers = {
    onTool: vi.fn(),
    onUndo: vi.fn(),
    onHint: vi.fn(),
    onSubmit: vi.fn(),
    onClearAll: vi.fn(),
    onToggleHelp: vi.fn(),
  }
  render(
    <ToolsPanel
      tools={TOOLS}
      active="select"
      canUndo
      canSubmit
      locked={false}
      helpOpen={false}
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

describe('ToolsPanel', () => {
  it('lists the stroke tools but not the implicit select tool', () => {
    setup()
    expect(screen.getByTestId('tool-x')).toBeInTheDocument()
    expect(screen.getByTestId('tool-eraser')).toBeInTheDocument()
    expect(screen.queryByTestId('tool-select')).toBeNull()
  })

  it('picks a tool, and a second press on the active tool goes back to select', () => {
    const { onTool } = setup()
    fireEvent.click(screen.getByTestId('tool-x'))
    expect(onTool).toHaveBeenLastCalledWith('x')
    cleanup()
    const again = setup({ active: 'x' })
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('tool-x'))
    expect(again.onTool).toHaveBeenLastCalledWith('select')
  })

  it('clears the whole board only when the eraser is held', () => {
    vi.useFakeTimers()
    const { onClearAll, onTool } = setup()
    const eraser = screen.getByTestId('tool-eraser')
    fireEvent.pointerDown(eraser)
    act(() => vi.advanceTimersByTime(900))
    fireEvent.pointerUp(eraser)
    fireEvent.click(eraser)
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onTool).not.toHaveBeenCalled()

    fireEvent.pointerDown(eraser)
    act(() => vi.advanceTimersByTime(200))
    fireEvent.pointerUp(eraser)
    fireEvent.click(eraser)
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onTool).toHaveBeenCalledWith('eraser')
  })

  it('disables undo with nothing to undo, and everything once locked', () => {
    setup({ canUndo: false })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    cleanup()
    setup({ locked: true })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByTestId('tool-x')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
  })

  it('only enables submit once everyone is placed', () => {
    setup({ canSubmit: false })
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
    cleanup()
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('wires hint, undo and the rules toggle', () => {
    const { onHint, onUndo, onToggleHelp } = setup({ helpOpen: true })
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }))
    expect(onHint).toHaveBeenCalled()
    expect(onUndo).toHaveBeenCalled()
    expect(onToggleHelp).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'How to play' })).toHaveAttribute('aria-expanded', 'true')
  })
})
```

Edit `tests/e2e/solve.spec.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/tests/e2e/solve.spec.ts b/tests/e2e/solve.spec.ts
index a3c56a5..f2a75f9 100644
--- a/tests/e2e/solve.spec.ts
+++ b/tests/e2e/solve.spec.ts
@@ -27,4 +27,5 @@ test('solves the daily puzzle through the UI and keeps the result after reload',
   }
 
+  await page.getByRole('button', { name: /Submit/ }).click()
   await page.getByTestId(`accuse-${killer}`).click()
   await expect(page.getByText('Case closed!')).toBeVisible()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/ToolsPanel.test.tsx src/ui/Game.test.tsx`
Expected: FAIL, cannot resolve `./ToolsPanel`; the Game tests cannot find the Hint and Submit buttons or the tool buttons.

- [ ] **Step 3: Implement**

Replace the whole of `src/index.css`:

```css
:root {
  color-scheme: light dark;
  --ink: #1f2430;
  --paper: #ffffff;
  --panel: #f8f8f8;
  --card: #ffffff;
  --border: #333333;
  --muted: #666666;
  --accent: #7a2e3b;
  --active: #f6e7b4;
  --mark: #1f2430;
  --shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
  --shadow-small: 2px 2px 0 rgba(0, 0, 0, 0.35);
  --wall-thick: 3px solid rgba(0, 0, 0, 0.9);
  --wall-thin: 1px solid rgba(0, 0, 0, 0.3);
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-hand: 'Caveat', 'Segoe Print', 'Bradley Hand', cursive;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ink: #f2eee8;
    --paper: #14111c;
    --panel: #1d1a28;
    --card: #262236;
    --border: #0a0814;
    --muted: #a7a3b5;
    --accent: #e58b9b;
    --active: #5a4a1d;
    --shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
    --shadow-small: 2px 2px 0 rgba(0, 0, 0, 0.6);
  }
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-body); }
button { font: inherit; color: inherit; cursor: pointer; }
h1, h2 { margin: 0; }

.game { max-width: 1320px; margin: 0 auto; padding: 0.75rem 1rem 2rem; }
.topbar { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.2rem 1rem; margin-bottom: 0.6rem; }
.topbar h1 { font-family: var(--font-hand); font-size: 2.4rem; line-height: 1; color: var(--accent); letter-spacing: 0.03em; }
.sub { margin: 0; color: var(--muted); font-size: 0.9rem; }
.how {
  margin-bottom: 0.8rem; padding: 0.6rem 1rem; background: var(--panel); border: 3px solid var(--border);
  box-shadow: var(--shadow); font-size: 0.9rem;
}
.how ul { margin: 0; padding-left: 1.2rem; }

.stage { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 900px) {
  .stage { grid-template-columns: minmax(250px, 0.8fr) minmax(380px, 1.2fr) 180px; }
  .play, .tools { position: sticky; top: 0.75rem; }
}

.suspects {
  list-style: none; margin: 0; padding: 0 6px 6px 0; display: grid; gap: 0.9rem 0.7rem;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
}
@media (max-width: 899px) {
  .suspects { display: flex; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 0.8rem; }
  .card { flex: 0 0 132px; scroll-snap-align: start; }
}
.card { display: flex; flex-direction: column; transform: rotate(var(--tilt, 0deg)); }
.card:nth-child(3n + 1) { --tilt: -0.8deg; }
.card:nth-child(3n + 2) { --tilt: 0.5deg; }
.card:nth-child(3n) { --tilt: -0.3deg; }
.portrait-card {
  display: flex; flex-direction: column; padding: 0; border: 3px solid var(--border); background: var(--card);
  box-shadow: var(--shadow); cursor: grab; touch-action: pan-x pan-y;
}
.portrait-card:active { cursor: grabbing; }
.portrait { display: block; aspect-ratio: 1; }
.portrait svg { display: block; width: 100%; height: 100%; }
.plate {
  display: block; padding: 0 0.2rem; border-top: 3px solid var(--border); background: var(--card);
  font-family: var(--font-hand); font-weight: 700; font-size: 1.4rem; line-height: 1.5; text-align: center;
}
.plate small { font-family: var(--font-body); font-size: 0.65rem; font-weight: 600; color: var(--accent); }
.clue-card {
  min-height: 3.8rem; padding: 0.4rem 0.5rem; border: 3px solid var(--border); border-top: 0; background: var(--card);
  box-shadow: var(--shadow); font-size: 0.8rem; line-height: 1.25; text-align: center;
}
.card.victim .plate { color: var(--accent); }
.card.placed .portrait-card { opacity: 0.55; }
.card.placed .plate::after { content: ' (on board)'; font-family: var(--font-body); font-size: 0.6rem; font-weight: 600; }
.portrait-card[aria-pressed='true'] { outline: 4px solid var(--accent); outline-offset: 2px; animation: breathe 1.6s ease-in-out infinite; }
.clue-card.struck { color: var(--muted); text-decoration: line-through; }
.clue-card.failing { background: #fdecec; border-color: #d12; color: #5a0b13; }

.board {
  display: grid; width: 100%; aspect-ratio: 1; border: 4px solid var(--border); background: var(--card);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.25); user-select: none; -webkit-user-select: none;
}
.board.stroking { touch-action: none; cursor: crosshair; }
.cell { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 0; overflow: visible; }
.cell[aria-disabled='true'] { cursor: default; }
.cell .sprite {
  position: absolute; inset: 7%; width: 86%; height: 86%; pointer-events: none;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.35));
}
.cell .mark { position: absolute; inset: 14%; width: 72%; height: 72%; pointer-events: none; }
.cell .mark path { fill: none; stroke: var(--mark); stroke-width: 12; stroke-linecap: round; }
.cell .token {
  position: absolute; inset: 8%; z-index: 1; overflow: hidden; border: 3px solid var(--border); border-radius: 50%;
  background: #fff; box-shadow: var(--shadow-small); pointer-events: none; animation: pop 0.25s ease-out;
}
.cell .token svg { display: block; width: 100%; height: 100%; }
.cell.conflict { outline: 3px solid #d12; outline-offset: -3px; z-index: 1; }
.cell.picked { outline: 3px solid var(--accent); outline-offset: -3px; z-index: 1; }
.cell.stroke-mark { box-shadow: inset 0 0 0 100px rgba(0, 0, 0, 0.14); }
.cell.stroke-unmark { filter: saturate(0.4) brightness(1.15); }
.cell.stroke-erase { box-shadow: inset 0 0 0 100px rgba(209, 17, 34, 0.28); }
.room-label {
  position: absolute; left: 3px; bottom: 1px; z-index: 2; pointer-events: none; white-space: nowrap;
  color: #fff; font-size: clamp(0.45rem, 1.9vw, 0.85rem); font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase;
  -webkit-text-stroke: 3px rgba(0, 0, 0, 0.85); paint-order: stroke fill;
}

.notice { min-height: 1.4rem; margin: 0.7rem 0 0; font-weight: 600; color: var(--accent); }
.accuse, .win { margin-top: 0.6rem; padding: 0.8rem; border: 3px solid var(--border); background: var(--card); box-shadow: var(--shadow); }
.accuse h2, .win h2 { margin-bottom: 0.4rem; font-family: var(--font-hand); font-size: 1.8rem; }
.accuse-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.accuse-buttons button {
  padding: 0.5rem 0.9rem; border: 3px solid var(--border); border-radius: 6px; background: var(--card);
  box-shadow: var(--shadow); font-weight: 700;
}
.win { animation: solved 0.8s ease-out; }

.tools { display: flex; flex-direction: column; gap: 0.6rem; }
.tools-title { color: var(--muted); font-size: 0.8rem; font-weight: 600; }
.tools-gap { flex: 1; min-height: 1rem; }
.tool, .action {
  display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.55rem 0.5rem;
  border: 3px solid var(--border); border-radius: 6px; background: var(--card); box-shadow: var(--shadow);
  font-weight: 800; text-transform: uppercase;
}
.tool small, .action small { font-size: 0.6rem; font-weight: 600; color: var(--muted); text-transform: none; }
.tool.active { background: var(--active); }
.tool:active:not(:disabled), .action:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: var(--shadow-small); }
.tool:disabled, .action:disabled { opacity: 0.45; box-shadow: none; cursor: default; }
.tool-icon { width: 2.2rem; height: 2.2rem; fill: none; stroke: currentColor; stroke-width: 12; stroke-linecap: round; stroke-linejoin: round; }
.tool-icon.eraser { stroke-width: 7; }
.action.submit:not(:disabled) { animation: nudge 1.4s ease-in-out 2; }
@media (max-width: 899px) {
  .tools { flex-direction: row; flex-wrap: wrap; }
  .tools > * { flex: 1 1 28%; }
  .tools-title, .tools-gap { display: none; }
}

.ghost {
  position: fixed; z-index: 10; width: 4.2rem; height: 4.2rem; overflow: hidden; border: 3px solid var(--border);
  border-radius: 50%; background: #fff; box-shadow: var(--shadow); pointer-events: none; transform: translate(-50%, -50%);
}
.ghost svg { display: block; width: 100%; height: 100%; }

@keyframes pop { from { transform: scale(0.5); } 70% { transform: scale(1.12); } to { transform: scale(1); } }
@keyframes breathe { 50% { outline-offset: 5px; } }
@keyframes nudge { 40% { transform: translateY(-3px); } 60% { transform: translateY(0); } }
@keyframes solved { 0% { background: #fff4d6; } 100% { background: var(--card); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Edit `src/main.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/main.tsx b/src/main.tsx
index 60c366a..8dc5a7d 100644
--- a/src/main.tsx
+++ b/src/main.tsx
@@ -1,4 +1,7 @@
 import { StrictMode } from 'react'
 import { createRoot } from 'react-dom/client'
+import '@fontsource/caveat/latin-700.css'
+import '@fontsource/inter/latin-400.css'
+import '@fontsource/inter/latin-700.css'
 import './index.css'
 import App from './App.tsx'
```

Delete `src/ui/CluePanel.tsx`:

```bash
git rm src/ui/CluePanel.tsx
```

Replace the whole of `src/ui/Game.tsx`:

```tsx
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { answerOf, evaluate, isLegalPlacement, isSolved } from '../engine/clues'
import { registry } from '../engine/registry'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { newGame, posKey, reduce } from '../state/reducer'
import { loadState, saveState } from '../state/storage'
import type { ReadableStorage, WritableStorage } from '../state/storage'
import { currentStreak, recordSolve } from '../state/streak'
import { Board } from './Board'
import { SuspectPanel } from './SuspectPanel'
import { ToolsPanel } from './ToolsPanel'

interface GameProps {
  puzzle: Puzzle
  dateKey: string
  puzzleId?: string
  storage: (ReadableStorage & WritableStorage) | null
  now?: () => number
}

function findConflicts(placements: Record<number, Pos>): Set<string> {
  const entries = Object.values(placements)
  const conflicts = new Set<string>()
  for (const a of entries) {
    for (const b of entries) {
      if (a !== b && (a.r === b.r || a.c === b.c)) conflicts.add(posKey(a))
    }
  }
  return conflicts
}

function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  return minutes > 0 ? `${minutes} min ${total % 60} s` : `${total} s`
}

export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: GameProps) {
  const [saved, setSaved] = useState(() => loadState(storage))
  const [game, dispatch] = useReducer(reduce, undefined, () =>
    saved.today?.dateKey === dateKey && saved.today.puzzleId === puzzleId
      ? { ...newGame(dateKey, now(), puzzleId), progress: saved.today }
      : newGame(dateKey, now(), puzzleId),
  )
  const [notice, setNotice] = useState('')
  const [check, setCheck] = useState<{ key: string; failing: number[] } | null>(null)
  const [accusing, setAccusing] = useState(false)
  const [help, setHelp] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const { progress, selected, tool } = game
  const solved = progress.solvedAt !== null

  useEffect(() => {
    saveState(storage, { ...saved, today: progress })
  }, [storage, saved, progress])

  const placementList = puzzle.suspects.map((_, i) => progress.placements[i])
  const allPlaced = placementList.every((pos) => pos !== undefined)
  const complete = allPlaced ? placementList : null
  const placementKey = JSON.stringify(progress.placements)
  const conflicts = useMemo(() => findConflicts(progress.placements), [progress.placements])
  const marks = useMemo(() => new Set(progress.marks), [progress.marks])
  const failing = new Set(check?.key === placementKey ? check.failing : [])
  const readyToAccuse = complete !== null && !solved && isSolved(puzzle, complete)
  const culprit = complete !== null ? answerOf(puzzle, complete) : null

  const onCellClick = (pos: Pos) => {
    if (solved || !isOccupiable(puzzle.cells[pos.r][pos.c])) return
    if (selected !== null) {
      dispatch({ type: 'place', pos })
      return
    }
    const occupant = Object.entries(progress.placements).find(([, p]) => posKey(p) === posKey(pos))
    if (occupant) dispatch({ type: 'select', suspect: Number(occupant[0]) })
    else dispatch({ type: 'toggleMark', pos })
  }

  const runCheck = (): boolean => {
    if (complete === null) {
      setNotice('Place every suspect before checking.')
      return false
    }
    if (!isLegalPlacement(puzzle, complete)) {
      setNotice('Two suspects share a row or column.')
      return false
    }
    const bad = puzzle.suspects
      .map((_, i) => i)
      .filter((i) => puzzle.clues.some((clue) => clue.suspect === i && !evaluate(clue, puzzle, complete)))
    setCheck({ key: placementKey, failing: bad })
    setNotice(
      bad.length === 0
        ? 'Everything fits. Now name the killer.'
        : `${bad.length} suspect${bad.length === 1 ? '' : 's'} contradict their clues.`,
    )
    return bad.length === 0
  }

  const onSubmit = () => {
    if (runCheck()) setAccusing(true)
  }

  const onClearAll = () => {
    if (window.confirm('Clear the whole board?')) dispatch({ type: 'reset' })
  }

  const onAccuse = (suspect: number) => {
    if (suspect !== culprit) {
      setNotice(`${puzzle.suspects[suspect].name} is innocent. Think again.`)
      return
    }
    const at = now()
    dispatch({ type: 'solved', at })
    setSaved((s) => ({
      ...s,
      history: { ...s.history, [dateKey]: { solved: true, seconds: Math.round((at - progress.startedAt) / 1000) } },
      streak: recordSolve(s.streak, dateKey),
    }))
    setNotice('')
  }

  const streak = currentStreak(saved.streak, dateKey)

  return (
    <main className="game">
      <header className="topbar">
        <h1>Whodoku</h1>
        <p className="sub">
          Daily puzzle {dateKey} (UTC) &middot; Streak {streak} &middot; Best {saved.streak.best}
        </p>
      </header>

      {help && (
        <section className="how" aria-label="How to play">
          <ul>
            <li>Place every suspect on the grid. Nobody may share a row or column with another suspect.</li>
            <li>Blocked squares (tables, shelves, plants, rocks, trees, TVs) cannot be occupied.</li>
            <li>Each clue is about the suspect it names. Rooms are outlined in dark borders.</li>
            <li>The victim was alone with the killer. Once everything fits, name the killer.</li>
            <li>Tap a suspect, then a square, or drag a suspect onto the grid.</li>
            <li>Pick the X tool and drag across squares to cross them out. The eraser clears squares; hold it to clear the board.</li>
          </ul>
        </section>
      )}

      <div className="stage">
        <SuspectPanel
          puzzle={puzzle}
          placements={progress.placements}
          selected={selected}
          struck={progress.struck}
          failing={failing}
          boardRef={boardRef}
          onSelect={(suspect) => dispatch({ type: 'select', suspect })}
          onToggleStrike={(suspect) => dispatch({ type: 'toggleStrike', suspect })}
          onDrop={(suspect, pos) => {
            if (solved) return
            dispatch({ type: 'select', suspect })
            dispatch({ type: 'place', pos })
          }}
        />

        <section className="play">
          <Board
            puzzle={puzzle}
            placements={progress.placements}
            marks={marks}
            selected={selected}
            conflicts={conflicts}
            tool={registry.tools().find((t) => t.id === tool)}
            gridRef={boardRef}
            onCellClick={onCellClick}
            onStroke={(cells, mode) => dispatch({ type: 'paint', cells, mode })}
          />

          <p className="notice" role="status">
            {notice}
          </p>

          {accusing && readyToAccuse && (
            <section className="accuse" aria-label="Accusation">
              <h2>Who did it?</h2>
              <div className="accuse-buttons">
                {puzzle.suspects.map(
                  (suspect, i) =>
                    i !== puzzle.victim && (
                      <button key={suspect.name} type="button" data-testid={`accuse-${i}`} onClick={() => onAccuse(i)}>
                        {suspect.name}
                      </button>
                    ),
                )}
              </div>
            </section>
          )}

          {solved && culprit !== null && (
            <section className="win" aria-label="Case closed">
              <h2>Case closed!</h2>
              <p>
                {puzzle.suspects[culprit].name} did it. Solved in {formatDuration(progress.solvedAt! - progress.startedAt)}.
              </p>
              <p>
                Streak: {saved.streak.current} &middot; Best: {saved.streak.best}. Come back tomorrow for a new case.
              </p>
            </section>
          )}
        </section>

        <ToolsPanel
          tools={registry.tools()}
          active={tool}
          canUndo={game.history.length > 0}
          canSubmit={allPlaced}
          locked={solved}
          helpOpen={help}
          onTool={(id) => dispatch({ type: 'setTool', tool: id })}
          onUndo={() => dispatch({ type: 'undo' })}
          onHint={runCheck}
          onSubmit={onSubmit}
          onClearAll={onClearAll}
          onToggleHelp={() => setHelp((open) => !open)}
        />
      </div>
    </main>
  )
}
```

Delete `src/ui/Legend.tsx`:

```bash
git rm src/ui/Legend.tsx
```

Delete `src/ui/SuspectTray.tsx`:

```bash
git rm src/ui/SuspectTray.tsx
```

Create `src/ui/ToolsPanel.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import type { ToolDef } from '../engine/plugin'

interface ToolsPanelProps {
  tools: readonly ToolDef[]
  active: string
  canUndo: boolean
  canSubmit: boolean
  locked: boolean
  helpOpen: boolean
  onTool: (id: string) => void
  onUndo: () => void
  onHint: () => void
  onSubmit: () => void
  onClearAll: () => void
  onToggleHelp: () => void
}

const HOLD_MS = 800

function ToolIcon({ id }: { id: string }) {
  if (id === 'x') {
    return (
      <svg viewBox="0 0 100 100" className="tool-icon" aria-hidden="true">
        <path d="M20 20L80 80M80 20L20 80" />
      </svg>
    )
  }
  if (id === 'eraser') {
    return (
      <svg viewBox="0 0 100 100" className="tool-icon eraser" aria-hidden="true">
        <path d="M18 62L52 18L82 40L48 84H30Z" />
        <path d="M34 44L66 66" />
      </svg>
    )
  }
  return null
}

interface ToolButtonProps {
  tool: ToolDef
  active: boolean
  disabled: boolean
  onPick: () => void
  onHold: () => void
}

function ToolButton({ tool, active, disabled, onPick, onHold }: ToolButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  return (
    <button
      type="button"
      data-testid={`tool-${tool.id}`}
      className={`tool${active ? ' active' : ''}`}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={() => {
        held.current = false
        if (!tool.holdToClear) return
        timer.current = setTimeout(() => {
          held.current = true
          onHold()
        }, HOLD_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (held.current) {
          held.current = false
          return
        }
        onPick()
      }}
    >
      <ToolIcon id={tool.id} />
      <span>{tool.label}</span>
      {tool.holdToClear && <small>hold to clear all</small>}
    </button>
  )
}

export function ToolsPanel({
  tools,
  active,
  canUndo,
  canSubmit,
  locked,
  helpOpen,
  onTool,
  onUndo,
  onHint,
  onSubmit,
  onClearAll,
  onToggleHelp,
}: ToolsPanelProps) {
  return (
    <aside className="tools" aria-label="Tools">
      <h2 className="tools-title">Tools</h2>
      {tools
        .filter((tool) => tool.paint)
        .map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={active === tool.id}
            disabled={locked}
            onPick={() => onTool(active === tool.id ? 'select' : tool.id)}
            onHold={onClearAll}
          />
        ))}
      <button type="button" className="action" disabled={locked || !canUndo} onClick={onUndo}>
        Undo
      </button>
      <span className="tools-gap" />
      <button type="button" className="action" disabled={locked} onClick={onHint}>
        Hint
      </button>
      <button type="button" className="action submit" disabled={locked || !canSubmit} onClick={onSubmit}>
        Submit
        {!canSubmit && !locked && <small>(place everyone first)</small>}
      </button>
      <button type="button" className="action" aria-expanded={helpOpen} onClick={onToggleHelp}>
        How to play
      </button>
    </aside>
  )
}
```

Edit `vite.config.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/vite.config.ts b/vite.config.ts
index 8dac7f8..6252ff0 100644
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -10,4 +10,5 @@ export default defineConfig({
     VitePWA({
       registerType: 'autoUpdate',
+      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
       includeAssets: ['icon.svg'],
       manifest: {
```

Install the bundled fonts (the CSS imports are in `src/main.tsx`; only the Latin subsets are imported so the offline cache stays small):

```bash
npm install @fontsource/inter @fontsource/caveat
npm run build
```

Expected: the build succeeds and the PWA step reports the font files in the precache list.

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the tools panel, the three-column shell and the visual language"
```

---

### Task 8: Polish and browser tests

Right-edge room labels grow leftwards instead of being clipped, phone cards get narrower so the board sits higher, and Playwright covers the two drag interactions with a real mouse.

**Files:**
- Modify: `src/ui/Board.tsx`, `src/index.css`, `tests/e2e/solve.spec.ts`

- [ ] **Step 1: Apply the polish**

Edit `src/index.css` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/index.css b/src/index.css
index 7982a92..34d3a8e 100644
--- a/src/index.css
+++ b/src/index.css
@@ -60,5 +60,5 @@ h1, h2 { margin: 0; }
 @media (max-width: 899px) {
   .suspects { display: flex; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 0.8rem; }
-  .card { flex: 0 0 132px; scroll-snap-align: start; }
+  .card { flex: 0 0 112px; scroll-snap-align: start; }
 }
 .card { display: flex; flex-direction: column; transform: rotate(var(--tilt, 0deg)); }
@@ -117,4 +117,5 @@ h1, h2 { margin: 0; }
   -webkit-text-stroke: 3px rgba(0, 0, 0, 0.85); paint-order: stroke fill;
 }
+.room-label.end { left: auto; right: 3px; }
 
 .notice { min-height: 1.4rem; margin: 0.7rem 0 0; font-weight: 600; color: var(--accent); }
```

Edit `src/ui/Board.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Board.tsx b/src/ui/Board.tsx
index 3d98112..ed0b1f1 100644
--- a/src/ui/Board.tsx
+++ b/src/ui/Board.tsx
@@ -145,5 +145,7 @@ export function Board({ puzzle, placements, marks, selected, conflicts, tool, gr
               }}
             >
-              {labelAt.has(key) && <span className="room-label">{labelAt.get(key)}</span>}
+              {labelAt.has(key) && (
+                <span className={`room-label${c >= puzzle.size - 2 ? ' end' : ''}`}>{labelAt.get(key)}</span>
+              )}
               {cell.object && <Sprite sprite={spriteFor(puzzle, cell.object)} className="sprite" />}
               {marked && (
```

- [ ] **Step 2: Add the browser tests**

Edit `tests/e2e/solve.spec.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/tests/e2e/solve.spec.ts b/tests/e2e/solve.spec.ts
index f2a75f9..00e8a0c 100644
--- a/tests/e2e/solve.spec.ts
+++ b/tests/e2e/solve.spec.ts
@@ -36,2 +36,35 @@ test('solves the daily puzzle through the UI and keeps the result after reload',
   await expect(page.getByText('Streak 1')).toBeVisible()
 })
+
+test('crosses out a row by dragging the X tool and undoes it in one step', async ({ page }) => {
+  await page.goto('./')
+  const row = page.locator('[data-testid^="cell-0-"]')
+  const size = await row.count()
+  const open = await page.locator('[data-testid^="cell-0-"]:not([aria-disabled="true"])').count()
+  const box = (await page.getByRole('grid').boundingBox())!
+  const y = box.y + box.height / size / 2
+
+  await page.getByTestId('tool-x').click()
+  await page.mouse.move(box.x + 4, y)
+  await page.mouse.down()
+  await page.mouse.move(box.x + box.width - 4, y, { steps: 12 })
+  await page.mouse.up()
+  await expect(page.locator('[data-testid^="cell-0-"][data-marked="true"]')).toHaveCount(open)
+
+  await page.getByRole('button', { name: 'Undo' }).click()
+  await expect(page.locator('[data-testid^="cell-0-"][data-marked="true"]')).toHaveCount(0)
+})
+
+test('places a suspect by dragging its card onto the board', async ({ page }) => {
+  const puzzle = dailyPuzzle(DAY)
+  const target = solve(puzzle)![0]
+  await page.goto('./')
+  const card = (await page.getByTestId('suspect-0').boundingBox())!
+  const cell = (await page.getByTestId(`cell-${target.r}-${target.c}`).boundingBox())!
+
+  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
+  await page.mouse.down()
+  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 12 })
+  await page.mouse.up()
+  await expect(page.getByTestId(`cell-${target.r}-${target.c}`)).toHaveAttribute('data-occupant', '0')
+})
```

- [ ] **Step 3: Run the browser tests**

Run: `npx playwright test`
Expected: `3 passed`: the solve test and the two drag tests (Playwright builds and serves the app itself; run `npx playwright install chromium` once if needed).

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Polish room labels and phone cards, add drag e2e tests"
```

---

### Task 9: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Edit `README.md` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/README.md b/README.md
index bf7485e..bb6c7f3 100644
--- a/README.md
+++ b/README.md
@@ -10,4 +10,7 @@ player, generated entirely in the browser (no backend). Installable as a PWA and
 - Each suspect has one or two clues. Rooms are outlined with dark borders and labeled.
 - The victim was alone with the killer. Once everyone fits, name the killer.
+- Tap a suspect card, then a square, or drag the card onto the grid. Tap a clue to cross it out.
+- Pick the X tool and drag across squares to cross them out. The eraser clears squares; hold it
+  to clear the whole board. Undo reverts the last action.
 - "Beside" means directly up, down, left or right, within the same room.
 
@@ -38,5 +41,6 @@ Playwright needs a browser once: `npx playwright install chromium`.
   generated puzzle is verified to have exactly one solution.
 - `src/state/` reducer, versioned localStorage persistence and streak logic.
-- `src/ui/` React components. They reach plugin content only through the registry.
+- `src/ui/` React components: suspect cards, board, tools panel, and `art/` (generated portraits,
+  data-driven sprites, room textures). They reach plugin content only through the registry.
 - `docs/design/` the specs and implementation plans.
 
@@ -60,4 +64,7 @@ commercial product; its name, art, themes and published puzzles are not used her
 trademark search on the name before launching commercially.
 
+Portraits, sprites and textures are original and generated in code. Inter and Caveat are bundled
+through `@fontsource` under the SIL Open Font License.
+
 ## License
 
```

- [ ] **Step 2: Full verification**

```bash
npx tsc -b && npx oxlint && npx vitest run && npm run build && npx playwright test
```

Expected: every command exits 0. Report the test counts you actually see.

- [ ] **Step 3: Look at it**

```bash
npx vite preview --port 4180 --strictPort
```

Open `http://localhost:4180/whodoku/` at 1400px and at 390px wide and check: three columns on the wide screen with the board sticky while the cards scroll; the card strip, board and tool buttons stacked on the phone; the X tool drags across several cells and one Undo reverts the whole stroke; the eraser removes a suspect; holding the eraser asks before clearing; a suspect card drags onto the board; Submit stays disabled until everyone is placed. Stop the server afterwards.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document the tools and art in the README"
```

- [ ] **Step 5: Hand back**

Do not merge. Report the branch name, the commit list (`git log --oneline main..ui-redesign`) and the verification output, then use superpowers:finishing-a-development-branch.

---

## Self-Review Notes

- **Spec coverage:** layout and cards (Tasks 6, 7); drag painting, previews, keyboard, one undo step per stroke (Tasks 1, 5); eraser removes suspects and marks, hold clears (Tasks 1, 2, 7); Hint and Submit (Task 7); card drag-to-place (Task 6); visual language including dark mode, tilt, hard shadows, wall weights and reduced motion (Task 7); original art as data (Tasks 3, 4); fonts bundled and cached for offline use (Task 7); e2e drag tests (Task 8). The timer, sound and share buttons are out of scope per the spec.
- **Known limits:** card drag needs a mouse (touch users tap a card, then a square); `touch-action` stays scrollable on cards so the phone strip can scroll. Room textures are chosen by room index, not stored in the theme.
- **Types used across tasks:** `PaintMode`, `ToolDef.paint`, `ToolDef.holdToClear`, `SpriteDef`, `SpriteShape` (all `src/engine/plugin.ts`); `GameState.tool`, `GameState.history`, actions `setTool`, `paint`, `undo` (`src/state/reducer.ts`); `cellAt`, `lineCells` (`src/ui/boardGeometry.ts`); `portraitFor`, `roomSurface`, `spriteFor`.
