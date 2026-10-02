# Clue Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make clues explorable, as in the clue hints spec: hovering or selecting a suspect card lights up what its clue names on the board (objects, rooms, rows, columns, other suspects), hovering a board cell names it and repeats the selected clue, and relation words in clues explain themselves.

**Architecture:** Clue types return their sentence as typed pieces (`ClueText`) instead of a string. A pure function turns pieces into highlight targets, and the UI renders pieces as bold words with glossary tooltips. Themes gain a `glossary` and object `label`s, enforced by the registry so a plugin cannot add a clue term that a theme does not explain.

**Tech Stack:** TypeScript 6, React 19, Vitest 5, Playwright, CSS. Spec: `docs/design/2026-10-02-clue-hints-spec.md`.

**Prerequisite:** the plugin-kernel and UI-redesign work is on `main` (it is, at 62307e3 or later). Baseline before starting: `npx tsc -b && npx vitest run` passes (208 tests).

**Conventions for every task:**
- Run commands from the repo root. Commit messages are imperative and short. No Co-Authored-By trailers.
- Code comments only where the reason is non-obvious. ASCII only.
- Each task ends green (`npx tsc -b && npx oxlint && npx vitest run`) and is committed on its own.
- "Edit" blocks are unified diffs against the previous task's result; apply them with your editor or `git apply`. "Create" and "Replace the whole of" blocks are complete files.
- Further visual rules are expected from the owner while this is built. Add each as a small follow-up task with its own failing test; do not fold them into these tasks.

**Decisions made while prototyping:**
- `ClueTypeDef.render` is replaced by `parts`; `renderClue` joins the parts, so every existing text expectation still holds.
- `ThemeDef.glossary` and `ThemeObject.label` are required. The registry rejects a theme that does not explain a term listed in any registered clue type's `terms`, whichever of the two is registered first.
- Hover on a card is also keyboard focus, but only when focus did not come from a pointer. Otherwise a tapped card would keep its hints after being deselected.
- Board cells show hover tooltips for mouse and pen only; touch gets highlights through the selected card. Cells deliberately have no focus-driven tooltip, for the same reason.
- `Highlight` and `NO_HIGHLIGHT` live in `src/ui/highlight.ts`, not `Board.tsx`, to keep Fast Refresh working.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/plugin.ts` | `ClueText`, `ClueTypeDef.parts` and `terms`, `ThemeDef.glossary`, `ThemeObject.label` |
| `src/engine/registry.ts` | Validates labels and glossary coverage |
| `src/engine/clues.ts` | `clueParts`; `renderClue` now joins parts |
| `src/engine/hints.ts` | `hintTargets` and `suspectHints`: what clue pieces name on the board |
| `src/plugins/classic/clues.ts`, `theme.ts` | Parts for all 14 clue types; glossary and labels |
| `src/ui/highlight.ts` | `Highlight` type and `NO_HIGHLIGHT` |
| `src/ui/Board.tsx` | Hint fill, hovered frame, tooltip, room outline, linked tokens |
| `src/ui/SuspectPanel.tsx` | Clue pieces as bold words with tooltips; whole-card hover/focus; selected and linked states |
| `src/ui/Game.tsx` | Active card = hovered or selected; computes the highlight and the selected clue text |
| `src/index.css` | Hint visuals, `--hint` color, tooltips |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch and confirm the baseline**

```bash
git switch -c clue-hints
npx tsc -b && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass; note the count.

---

### Task 1: Clue text as typed pieces, with a glossary

Each clue type returns its sentence as pieces: plain text, relation words (keyed into a glossary), objects, rooms, people, columns and rows. Splitting a phrase keeps the article outside the bold object ("a **chair**"). Themes must explain every relation word their clue types can show, and give each object a display label.

**Files:**
- Modify: `src/engine/plugin.ts`, `src/engine/registry.ts`, `src/engine/clues.ts`, `src/plugins/classic/clues.ts`, `src/plugins/classic/theme.ts`
- Test: `src/engine/registry.test.ts`, `src/plugins/classic/parts.test.ts`, `src/plugins/classic/layout.test.ts`, `src/plugins/extensibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Edit `src/engine/registry.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.test.ts b/src/engine/registry.test.ts
index 295a0ee..0ad3571 100644
--- a/src/engine/registry.test.ts
+++ b/src/engine/registry.test.ts
@@ -9,7 +9,8 @@ const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
   rooms: ['A', 'B'],
   suspects: ['X', 'Y'],
+  glossary: {},
   objects: {
-    seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
-    wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
+    seat: { label: 'Seat', noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+    wall: { label: 'Wall', noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
   },
   ...overrides,
@@ -84,5 +85,5 @@ describe('registry', () => {
           scope: 'weird' as never,
           evaluate: () => true,
-          render: () => '',
+          parts: () => [],
         }),
     })
@@ -132,5 +133,5 @@ describe('theme validation', () => {
 
   it('rejects an object that is not a registered kind', () => {
-    const objects = { ghost: { noun: 'a ghost', standingOn: 'on a ghost', sprite: SPRITE, weight: 0.1 } }
+    const objects = { ghost: { label: 'Thing', noun: 'a ghost', standingOn: 'on a ghost', sprite: SPRITE, weight: 0.1 } }
     expect(() => createRegistry().register(withTheme({ objects }))).toThrow('"ghost" is not a registered object kind')
   })
@@ -138,6 +139,6 @@ describe('theme validation', () => {
   it('rejects an object without a noun or a sprite', () => {
     const objects = {
-      seat: { noun: '', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
-      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
+      seat: { label: 'Thing', noun: '', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+      wall: { label: 'Thing', noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
     }
     expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a noun, standingOn and a sprite')
@@ -147,11 +148,57 @@ describe('theme validation', () => {
 
   it('needs both a blocking and an occupiable object that can spawn', () => {
-    const onlySeat = { seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 } }
+    const onlySeat = { seat: { label: 'Thing', noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 } }
     expect(() => createRegistry().register(withTheme({ objects: onlySeat }))).toThrow('at least one blocking object')
     const wallNeverSpawns = {
-      seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
-      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0 },
+      seat: { label: 'Thing', noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+      wall: { label: 'Thing', noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0 },
     }
     expect(() => createRegistry().register(withTheme({ objects: wallNeverSpawns }))).toThrow('at least one blocking object')
   })
+
+  it('needs a label on every object', () => {
+    const objects = {
+      seat: { label: '', noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
+      wall: { label: 'Wall', noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
+    }
+    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a label')
+  })
+})
+
+describe('glossary coverage', () => {
+  const withClue = (terms: string[]): Plugin => ({
+    id: 'terms',
+    version: '1.0.0',
+    register(api) {
+      api.addObjectKind({ id: 'seat', blocking: false })
+      api.addObjectKind({ id: 'wall', blocking: true })
+      api.addClueType({ id: 'near', scope: 'unary', evaluate: () => true, parts: () => [], terms })
+    },
+  })
+
+  it('rejects a theme that does not explain a clue term', () => {
+    const registry = createRegistry()
+    registry.register(withClue(['beside']))
+    const lacking: Plugin = { id: 'lacking', version: '1.0.0', register: (api) => api.addTheme(theme()) }
+    expect(() => registry.register(lacking)).toThrow('missing glossary entries for clue type "near": beside')
+  })
+
+  it('rejects a clue type whose term an existing theme does not explain', () => {
+    const registry = createRegistry()
+    registry.register(base())
+    const clueOnly: Plugin = {
+      id: 'clue-only',
+      version: '1.0.0',
+      register: (api) => api.addClueType({ id: 'near', scope: 'unary', evaluate: () => true, parts: () => [], terms: ['beside'] }),
+    }
+    expect(() => registry.register(clueOnly)).toThrow('missing glossary entries for clue type "near": beside')
+  })
+
+  it('accepts themes that explain every term', () => {
+    const registry = createRegistry()
+    registry.register(withClue(['beside']))
+    const explained: Plugin = { id: 'explained', version: '1.0.0', register: (api) => api.addTheme(theme({ glossary: { beside: 'next to' } })) }
+    registry.register(explained)
+    expect(registry.theme('t').glossary.beside).toBe('next to')
+  })
 })
```

Edit `src/plugins/classic/layout.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/layout.test.ts b/src/plugins/classic/layout.test.ts
index 8cb5162..92f9b8c 100644
--- a/src/plugins/classic/layout.test.ts
+++ b/src/plugins/classic/layout.test.ts
@@ -65,7 +65,8 @@ describe('generateLayout', () => {
       rooms: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
       suspects: ['S'],
+      glossary: {},
       objects: {
-        chair: { noun: 'a chair', standingOn: 'on a chair', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.5 },
-        table: { noun: 'a table', standingOn: 'on a table', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.4 },
+        chair: { label: 'Chair', noun: 'a chair', standingOn: 'on a chair', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.5 },
+        table: { label: 'Table', noun: 'a table', standingOn: 'on a table', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.4 },
       },
     }
```

Create `src/plugins/classic/parts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clueParts, renderClue } from '../../engine/clues'
import { tiny } from '../../engine/fixtures'
import type { ClueText } from '../../engine/plugin'
import type { Clue } from '../../engine/types'
import { classicTheme } from './theme'

const ANN = 0
const BOB = 1
const DI = 3

const person = (suspect: number): ClueText => ({ kind: 'person', text: tiny.suspects[suspect].name, suspect })
const text = (t: string): ClueText => ({ kind: 'text', text: t })

describe('clueParts', () => {
  const cases: [string, Clue, ClueText[]][] = [
    ['inRoom', { type: 'inRoom', suspect: BOB, room: 2 }, [person(BOB), text(' was in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')]],
    [
      'notInRoom',
      { type: 'notInRoom', suspect: BOB, room: 2 },
      [person(BOB), text(' was '), { kind: 'relation', text: 'not', term: 'not' }, text(' in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')],
    ],
    [
      'onObject keeps the article outside the object',
      { type: 'onObject', suspect: BOB, kind: 'chair' },
      [person(BOB), text(' was '), text('sitting on a '), { kind: 'object', text: 'chair', object: 'chair' }, text('.')],
    ],
    [
      'onObject with the water',
      { type: 'onObject', suspect: DI, kind: 'water' },
      [person(DI), text(' was '), text('in the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    [
      'notOnObject',
      { type: 'notOnObject', suspect: BOB, kind: 'rug' },
      [person(BOB), text(' was '), { kind: 'relation', text: 'not', term: 'not' }, text(' '), text('on a '), { kind: 'object', text: 'rug', object: 'rug' }, text('.')],
    ],
    [
      'besideObject',
      { type: 'besideObject', suspect: ANN, kind: 'shelf' },
      [person(ANN), text(' was '), { kind: 'relation', text: 'beside', term: 'beside' }, text(' '), text('a '), { kind: 'object', text: 'shelf', object: 'shelf' }, text('.')],
    ],
    [
      'notBesideObject',
      { type: 'notBesideObject', suspect: ANN, kind: 'water' },
      [
        person(ANN),
        text(' was '),
        { kind: 'relation', text: 'not', term: 'not' },
        text(' '),
        { kind: 'relation', text: 'beside', term: 'beside' },
        text(' '),
        text('the '),
        { kind: 'object', text: 'water', object: 'water' },
        text('.'),
      ],
    ],
    ['inColumn', { type: 'inColumn', suspect: ANN, col: 1 }, [person(ANN), text(' was in '), { kind: 'column', text: 'column 2', col: 1 }, text('.')]],
    ['inRow', { type: 'inRow', suspect: ANN, row: 0 }, [person(ANN), text(' was in '), { kind: 'row', text: 'row 1', row: 0 }, text('.')]],
    [
      'northOf',
      { type: 'northOf', suspect: ANN, other: BOB, delta: 2 },
      [person(ANN), text(' was '), { kind: 'relation', text: 'two rows north of', term: 'north of' }, text(' '), person(BOB), text('.')],
    ],
    [
      'westOf',
      { type: 'westOf', suspect: BOB, other: ANN, delta: 1 },
      [person(BOB), text(' was '), { kind: 'relation', text: 'one column west of', term: 'west of' }, text(' '), person(ANN), text('.')],
    ],
    [
      'sameRoomAs',
      { type: 'sameRoomAs', suspect: ANN, other: BOB },
      [person(ANN), text(' was in '), { kind: 'relation', text: 'the same room as', term: 'same room' }, text(' '), person(BOB), text('.')],
    ],
    ['aloneInRoom', { type: 'aloneInRoom', suspect: BOB }, [person(BOB), text(' was '), { kind: 'relation', text: 'alone', term: 'alone' }, text('.')]],
    [
      'withOneOther',
      { type: 'withOneOther', suspect: BOB },
      [person(BOB), text(' was with '), { kind: 'relation', text: 'exactly one other person', term: 'exactly one other' }, text('.')],
    ],
    [
      'withOneOther for the victim',
      { type: 'withOneOther', suspect: ANN },
      [person(ANN), text(' was '), { kind: 'relation', text: 'alone with the killer', term: 'alone with the killer' }, text('.')],
    ],
    [
      'onlyOnObject',
      { type: 'onlyOnObject', suspect: BOB, kind: 'chair' },
      [
        person(BOB),
        text(' was '),
        { kind: 'relation', text: 'the only person', term: 'only' },
        text(' '),
        text('sitting on a '),
        { kind: 'object', text: 'chair', object: 'chair' },
        text('.'),
      ],
    ],
  ]

  it.each(cases)('%s', (_name, clue, expected) => {
    expect(clueParts(clue, tiny)).toEqual(expected)
  })

  it('joins into the same sentence renderClue returns', () => {
    for (const [, clue] of cases) {
      expect(renderClue(clue, tiny)).toBe(clueParts(clue, tiny).map((part) => part.text).join(''))
    }
  })
})

describe('classic glossary', () => {
  it('explains every relation term a clue can show', () => {
    const terms = ['not', 'beside', 'north of', 'west of', 'same room', 'alone', 'only', 'exactly one other', 'alone with the killer']
    for (const term of terms) expect(classicTheme.glossary[term]).toBeTruthy()
  })
})
```

Edit `src/plugins/extensibility.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/extensibility.test.ts b/src/plugins/extensibility.test.ts
index 5cca8a4..8cd8974 100644
--- a/src/plugins/extensibility.test.ts
+++ b/src/plugins/extensibility.test.ts
@@ -6,4 +6,5 @@ import { registry } from '../engine/registry'
 import { countSolutions } from '../engine/solver'
 import { generate } from './classic/generator'
+import { classicTheme } from './classic/theme'
 
 const SPRITE: SpriteDef = { shapes: [{ kind: 'rect', x: 10, y: 10, w: 80, h: 80, fill: '#444' }] }
@@ -21,7 +22,8 @@ const noir: Plugin = {
       rooms: NOIR_ROOMS,
       suspects: NOIR_SUSPECTS,
+      glossary: classicTheme.glossary,
       objects: {
-        chair: { noun: 'a barstool', standingOn: 'perched on a barstool', sprite: SPRITE, weight: 0.1 },
-        shelf: { noun: 'a safe', standingOn: 'on a safe', sprite: SPRITE, weight: 0.05 },
+        chair: { label: 'Barstool', noun: 'a barstool', standingOn: 'perched on a barstool', sprite: SPRITE, weight: 0.1 },
+        shelf: { label: 'Safe', noun: 'a safe', standingOn: 'on a safe', sprite: SPRITE, weight: 0.05 },
       },
     })
@@ -30,5 +32,8 @@ const noir: Plugin = {
       scope: 'unary',
       evaluate: (clue, _puzzle, placement) => placement[clue.suspect].r !== clue.row,
-      render: (clue, puzzle) => `${puzzle.suspects[clue.suspect].name} avoided row ${Number(clue.row) + 1}.`,
+      parts: (clue, puzzle) => [
+        { kind: 'person', text: puzzle.suspects[clue.suspect].name, suspect: clue.suspect },
+        { kind: 'text', text: ` avoided row ${Number(clue.row) + 1}.` },
+      ],
     })
   },
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/engine/registry.test.ts src/plugins/classic/parts.test.ts`
Expected: FAIL. `clueParts` does not exist, the classic theme has no glossary, and the registry accepts themes without glossary entries.

- [ ] **Step 3: Implement**

Edit `src/engine/clues.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/clues.ts b/src/engine/clues.ts
index 5e5913c..e1a2c2e 100644
--- a/src/engine/clues.ts
+++ b/src/engine/clues.ts
@@ -1,2 +1,3 @@
+import type { ClueText } from './plugin'
 import { registry } from './registry'
 import { isOccupiable } from './types'
@@ -9,6 +10,12 @@ export function evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): bool
 }
 
+export function clueParts(clue: Clue, puzzle: Puzzle): ClueText[] {
+  return registry.clueType(clue.type).parts(clue, puzzle, registry.theme(puzzle.themeId))
+}
+
 export function renderClue(clue: Clue, puzzle: Puzzle): string {
-  return registry.clueType(clue.type).render(clue, puzzle, registry.theme(puzzle.themeId))
+  return clueParts(clue, puzzle)
+    .map((part) => part.text)
+    .join('')
 }
 
```

Edit `src/engine/plugin.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/plugin.ts b/src/engine/plugin.ts
index 28a4d15..f297d8a 100644
--- a/src/engine/plugin.ts
+++ b/src/engine/plugin.ts
@@ -30,4 +30,5 @@ export interface SpriteDef {
 
 export interface ThemeObject {
+  label: string
   noun: string
   standingOn: string
@@ -41,11 +42,25 @@ export interface ThemeDef {
   suspects: readonly string[]
   objects: Readonly<Record<string, ThemeObject>>
+  /** One-line explanations for the relation words clues use, keyed by `ClueText` term. */
+  glossary: Readonly<Record<string, string>>
 }
 
+/** A clue sentence as pieces, so the UI can bold words, explain them and highlight what they name. */
+export type ClueText =
+  | { kind: 'text'; text: string }
+  | { kind: 'relation'; text: string; term: string }
+  | { kind: 'object'; text: string; object: string }
+  | { kind: 'room'; text: string; room: number }
+  | { kind: 'person'; text: string; suspect: number }
+  | { kind: 'column'; text: string; col: number }
+  | { kind: 'row'; text: string; row: number }
+
 export interface ClueTypeDef {
   id: string
   scope: ClueScope
   evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean
-  render(clue: Clue, puzzle: Puzzle, theme: ThemeDef): string
+  parts(clue: Clue, puzzle: Puzzle, theme: ThemeDef): ClueText[]
+  /** Glossary terms the parts can contain; every registered theme must explain them. */
+  terms?: readonly string[]
   candidates?(puzzle: Puzzle, placement: Placement, suspect: number): Clue[]
   prune?(clue: Clue, puzzle: Puzzle, assigned: PartialPlacement): boolean
```

Edit `src/engine/registry.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.ts b/src/engine/registry.ts
index 1fffb60..795425a 100644
--- a/src/engine/registry.ts
+++ b/src/engine/registry.ts
@@ -67,4 +67,5 @@ export function validateTheme(theme: ThemeDef, kinds: ReadonlyMap<string, Object
       fail(`object "${id}" needs a noun, standingOn and a sprite`)
     }
+    if (!object.label) fail(`object "${id}" needs a label`)
   }
   const spawning = entries.filter(([, object]) => object.weight > 0).map(([id]) => kinds.get(id)!)
@@ -110,4 +111,14 @@ export function createRegistry(): Registry {
     plugin.register(api)
     for (const theme of staged.themes.values()) validateTheme(theme, staged.objectKinds)
+    for (const theme of staged.themes.values()) {
+      for (const clue of staged.clueTypes.values()) {
+        const missing = (clue.terms ?? []).filter((term) => !theme.glossary[term])
+        if (missing.length > 0) {
+          throw new Error(
+            `Invalid theme "${theme.id}": missing glossary entries for clue type "${clue.id}": ${missing.join(', ')}`,
+          )
+        }
+      }
+    }
     return staged
   }
```

Replace the whole of `src/plugins/classic/clues.ts`:

```ts
import { objectKindsIn } from '../../engine/candidates'
import type { ClueText, ClueTypeDef, PartialPlacement, ThemeDef } from '../../engine/plugin'
import type { Clue, Placement, Pos, Puzzle } from '../../engine/types'

type RoomClue = Clue & { room: number }
type KindClue = Clue & { kind: string }
type ColumnClue = Clue & { col: number }
type RowClue = Clue & { row: number }
type OtherClue = Clue & { other: number }
type OffsetClue = OtherClue & { delta: number }

const NEIGHBOR_STEPS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
]

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const roomOf = (puzzle: Puzzle, pos: Pos): number => puzzle.cells[pos.r][pos.c].room
const objectAt = (puzzle: Puzzle, pos: Pos): string | null => puzzle.cells[pos.r][pos.c].object
const nameOf = (puzzle: Puzzle, suspect: number): string => puzzle.suspects[suspect].name
const plural = (n: number, unit: string): string => `${NUMBER_WORDS[n] ?? n} ${unit}${n === 1 ? '' : 's'}`

function suspectsInRoom(puzzle: Puzzle, placement: Placement, room: number): number {
  return placement.filter((pos) => roomOf(puzzle, pos) === room).length
}

function isBesideObject(puzzle: Puzzle, pos: Pos, kind: string): boolean {
  const room = roomOf(puzzle, pos)
  return NEIGHBOR_STEPS.some(({ r, c }) => {
    const next = { r: pos.r + r, c: pos.c + c }
    const inBounds = next.r >= 0 && next.c >= 0 && next.r < puzzle.size && next.c < puzzle.size
    return inBounds && roomOf(puzzle, next) === room && objectAt(puzzle, next) === kind
  })
}

function placedWithSuspect(puzzle: Puzzle, assigned: PartialPlacement, suspect: number): number | null {
  const pos = assigned[suspect]
  if (!pos) return null
  const room = roomOf(puzzle, pos)
  return assigned.filter((p) => p !== undefined && roomOf(puzzle, p) === room).length
}

const perRoom =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    puzzle.rooms.map((_, room) => ({ type, suspect, room }))

const perKind =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    objectKindsIn(puzzle).map((kind) => ({ type, suspect, kind }))

const bare =
  (type: string) =>
  (_puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] => [{ type, suspect }]

const text = (value: string): ClueText => ({ kind: 'text', text: value })
const relation = (value: string, term: string): ClueText => ({ kind: 'relation', text: value, term })
const person = (puzzle: Puzzle, suspect: number): ClueText => ({ kind: 'person', text: nameOf(puzzle, suspect), suspect })
const roomText = (puzzle: Puzzle, room: number): ClueText => ({ kind: 'room', text: puzzle.rooms[room], room })

const ARTICLE = /^(an?|the) /

/** Splits a phrase around the object noun so the article stays plain and only the noun is the object. */
function objectParts(phrase: string, noun: string, kind: string): ClueText[] {
  const at = phrase.lastIndexOf(noun)
  if (at < 0) return [{ kind: 'object', text: phrase, object: kind }]
  const article = ARTICLE.exec(noun)?.[0] ?? ''
  const head = phrase.slice(0, at) + article
  const tail = phrase.slice(at + noun.length)
  return [
    ...(head ? [text(head)] : []),
    { kind: 'object', text: noun.slice(article.length), object: kind },
    ...(tail ? [text(tail)] : []),
  ]
}

const standingParts = (theme: ThemeDef, kind: string): ClueText[] =>
  objectParts(theme.objects[kind].standingOn, theme.objects[kind].noun, kind)
const nounParts = (theme: ThemeDef, kind: string): ClueText[] =>
  objectParts(theme.objects[kind].noun, theme.objects[kind].noun, kind)

const inRoom: ClueTypeDef = {
  id: 'inRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) === clue.room,
  parts: (clue: RoomClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in the '),
    roomText(puzzle, clue.room),
    text('.'),
  ],
  candidates: perRoom('inRoom'),
}

const notInRoom: ClueTypeDef = {
  id: 'notInRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) !== clue.room,
  terms: ['not'],
  parts: (clue: RoomClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' in the '),
    roomText(puzzle, clue.room),
    text('.'),
  ],
  candidates: perRoom('notInRoom'),
}

const onObject: ClueTypeDef = {
  id: 'onObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) === clue.kind,
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('onObject'),
}

const notOnObject: ClueTypeDef = {
  id: 'notOnObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) !== clue.kind,
  terms: ['not'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('notOnObject'),
}

const besideObject: ClueTypeDef = {
  id: 'besideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  terms: ['beside'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('beside', 'beside'),
    text(' '),
    ...nounParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('besideObject'),
}

const notBesideObject: ClueTypeDef = {
  id: 'notBesideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => !isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  terms: ['not', 'beside'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' '),
    relation('beside', 'beside'),
    text(' '),
    ...nounParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('notBesideObject'),
}

const inColumn: ClueTypeDef = {
  id: 'inColumn',
  scope: 'unary',
  evaluate: (clue: ColumnClue, _puzzle, placement) => placement[clue.suspect].c === clue.col,
  parts: (clue: ColumnClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    { kind: 'column', text: `column ${clue.col + 1}`, col: clue.col },
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) => [{ type: 'inColumn', suspect, col: placement[suspect].c }],
}

const inRow: ClueTypeDef = {
  id: 'inRow',
  scope: 'unary',
  evaluate: (clue: RowClue, _puzzle, placement) => placement[clue.suspect].r === clue.row,
  parts: (clue: RowClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    { kind: 'row', text: `row ${clue.row + 1}`, row: clue.row },
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) => [{ type: 'inRow', suspect, row: placement[suspect].r }],
}

const northOf: ClueTypeDef = {
  id: 'northOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].r === placement[clue.other].r - clue.delta,
  terms: ['north of'],
  parts: (clue: OffsetClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation(`${plural(clue.delta, 'row')} north of`, 'north of'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.r > placement[suspect].r
        ? [{ type: 'northOf', suspect, other: index, delta: other.r - placement[suspect].r }]
        : [],
    ),
}

const westOf: ClueTypeDef = {
  id: 'westOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].c === placement[clue.other].c - clue.delta,
  terms: ['west of'],
  parts: (clue: OffsetClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation(`${plural(clue.delta, 'column')} west of`, 'west of'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.c > placement[suspect].c
        ? [{ type: 'westOf', suspect, other: index, delta: other.c - placement[suspect].c }]
        : [],
    ),
}

const sameRoomAs: ClueTypeDef = {
  id: 'sameRoomAs',
  scope: 'binary',
  evaluate: (clue: OtherClue, puzzle, placement) =>
    roomOf(puzzle, placement[clue.suspect]) === roomOf(puzzle, placement[clue.other]),
  terms: ['same room'],
  parts: (clue: OtherClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    relation('the same room as', 'same room'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((_, index) => (index === suspect ? [] : [{ type: 'sameRoomAs', suspect, other: index }])),
}

const aloneInRoom: ClueTypeDef = {
  id: 'aloneInRoom',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 1,
  terms: ['alone'],
  parts: (clue, puzzle) => [person(puzzle, clue.suspect), text(' was '), relation('alone', 'alone'), text('.')],
  candidates: bare('aloneInRoom'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 1,
}

const withOneOther: ClueTypeDef = {
  id: 'withOneOther',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 2,
  terms: ['alone with the killer', 'exactly one other'],
  parts: (clue, puzzle) =>
    clue.suspect === puzzle.victim
      ? [
          person(puzzle, clue.suspect),
          text(' was '),
          relation('alone with the killer', 'alone with the killer'),
          text('.'),
        ]
      : [
          person(puzzle, clue.suspect),
          text(' was with '),
          relation('exactly one other person', 'exactly one other'),
          text('.'),
        ],
  candidates: bare('withOneOther'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 2,
  feasible(clue, puzzle, assigned, reachableByRoom) {
    const pos = assigned[clue.suspect]
    if (!pos) return true
    const room = roomOf(puzzle, pos)
    const present = assigned.filter((p) => p && roomOf(puzzle, p) === room).length
    return present >= 2 || reachableByRoom[room] >= 2 - present
  },
}

const onlyOnObject: ClueTypeDef = {
  id: 'onlyOnObject',
  scope: 'global',
  evaluate: (clue: KindClue, puzzle, placement) =>
    objectAt(puzzle, placement[clue.suspect]) === clue.kind &&
    placement.filter((p) => objectAt(puzzle, p) === clue.kind).length === 1,
  terms: ['only'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('the only person', 'only'),
    text(' '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('onlyOnObject'),
  prune: (clue: KindClue, puzzle, assigned) => assigned.filter((p) => p && objectAt(puzzle, p) === clue.kind).length <= 1,
}

export const CLUE_TYPES: readonly ClueTypeDef[] = [
  inRoom,
  notInRoom,
  onObject,
  notOnObject,
  besideObject,
  notBesideObject,
  inColumn,
  inRow,
  northOf,
  westOf,
  sameRoomAs,
  aloneInRoom,
  withOneOther,
  onlyOnObject,
]
```

Edit `src/plugins/classic/theme.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/theme.ts b/src/plugins/classic/theme.ts
index c01c491..4286300 100644
--- a/src/plugins/classic/theme.ts
+++ b/src/plugins/classic/theme.ts
@@ -41,13 +41,24 @@ export const classicTheme: ThemeDef = {
   ],
   objects: {
-    chair: { noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
-    rug: { noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
-    water: { noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
-    table: { noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
-    shelf: { noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
-    plant: { noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
-    rock: { noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
-    tree: { noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
-    tv: { noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
+    chair: { label: 'Chair', noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
+    rug: { label: 'Rug', noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
+    water: { label: 'Water', noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
+    table: { label: 'Table', noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
+    shelf: { label: 'Shelf', noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
+    plant: { label: 'Plant', noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
+    rock: { label: 'Rock', noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
+    tree: { label: 'Tree', noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
+    tv: { label: 'TV', noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
+  },
+  glossary: {
+    not: 'The opposite is true: this is where they were not.',
+    beside: 'Directly left, right, above or below something, in the same room. Diagonals do not count.',
+    'north of': 'In a row above, counting rows from the top of the board. The number says how many rows apart.',
+    'west of': 'In a column to the left. The number says how many columns apart.',
+    'same room': 'Both were inside the same room, in different squares.',
+    alone: 'Nobody else was in the same room.',
+    only: 'Nobody else stood on that kind of object.',
+    'exactly one other': 'Exactly two people, counting them, were in the room.',
+    'alone with the killer': 'The victim and the killer were the only two people in the room.',
   },
 }
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Return clue text as typed pieces and add a theme glossary"
```

---

### Task 2: Resolve clue pieces into highlight targets

A pure function turns clue pieces into what they name on the board: object cells, a room's cells and its boundary, a column or row, and other suspects (never the clue's own subject). `suspectHints` merges all of a suspect's clues.

**Files:**
- Create: `src/engine/hints.ts`
- Test: `src/engine/hints.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/hints.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clueParts } from './clues'
import { tiny } from './fixtures'
import { hintTargets, suspectHints } from './hints'
import type { ClueText } from './plugin'
import type { Clue } from './types'

const ANN = 0
const BOB = 1

const targets = (clue: Clue) => hintTargets(clueParts(clue, tiny), tiny, clue.suspect)
const keys = (cells: { r: number; c: number }[]) => cells.map((p) => `${p.r},${p.c}`).sort()

describe('hintTargets', () => {
  it('lights every cell holding the named object', () => {
    const hint = targets({ type: 'onObject', suspect: BOB, kind: 'chair' })
    expect(keys(hint.cells)).toEqual(['1,0', '2,1'])
    expect(hint.rooms).toEqual([])
    expect(hint.suspects).toEqual([])
  })

  it('lights only the object for a beside clue, not its neighbors', () => {
    expect(keys(targets({ type: 'besideObject', suspect: ANN, kind: 'shelf' }).cells)).toEqual(['1,1'])
  })

  it('lights a whole room and reports it for the boundary outline', () => {
    const hint = targets({ type: 'inRoom', suspect: BOB, room: 2 })
    expect(keys(hint.cells)).toEqual(['2,0', '2,1', '3,0', '3,1'])
    expect(hint.rooms).toEqual([2])
  })

  it('lights a column or a row', () => {
    expect(keys(targets({ type: 'inColumn', suspect: ANN, col: 2 }).cells)).toEqual(['0,2', '1,2', '2,2', '3,2'])
    expect(keys(targets({ type: 'inRow', suspect: ANN, row: 0 }).cells)).toEqual(['0,0', '0,1', '0,2', '0,3'])
  })

  it('points at the other person, never at the clue subject', () => {
    const hint = targets({ type: 'northOf', suspect: ANN, other: BOB, delta: 1 })
    expect(hint.suspects).toEqual([BOB])
    expect(hint.cells).toEqual([])
  })

  it('lights nothing for company clues', () => {
    for (const clue of [
      { type: 'aloneInRoom', suspect: BOB },
      { type: 'withOneOther', suspect: ANN },
    ]) {
      expect(targets(clue)).toEqual({ cells: [], rooms: [], suspects: [] })
    }
  })

  it('combines every kind of target a clue names', () => {
    const parts: ClueText[] = [
      { kind: 'person', text: 'Ann', suspect: ANN },
      { kind: 'text', text: ' was near ' },
      { kind: 'person', text: 'Bob', suspect: BOB },
      { kind: 'object', text: 'chair', object: 'chair' },
      { kind: 'room', text: 'Hall', room: 0 },
    ]
    const hint = hintTargets(parts, tiny, ANN)
    expect(hint.suspects).toEqual([BOB])
    expect(hint.rooms).toEqual([0])
    expect(keys(hint.cells)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,1'])
  })
})

describe('suspectHints', () => {
  it('merges the targets of all of a suspect\'s clues without duplicates', () => {
    const puzzle = {
      ...tiny,
      clues: [
        { type: 'onObject', suspect: BOB, kind: 'chair' },
        { type: 'inRoom', suspect: BOB, room: 0 },
        { type: 'onObject', suspect: 2, kind: 'rug' },
      ],
    }
    const hint = suspectHints(puzzle, BOB)
    expect(keys(hint.cells)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,1'])
    expect(hint.rooms).toEqual([0])
  })

  it('is empty for a suspect with no clues', () => {
    expect(suspectHints({ ...tiny, clues: [] }, BOB)).toEqual({ cells: [], rooms: [], suspects: [] })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/engine/hints.test.ts`
Expected: FAIL, cannot resolve `./hints`.

- [ ] **Step 3: Implement**

Create `src/engine/hints.ts`:

```ts
import { clueParts } from './clues'
import type { ClueText } from './plugin'
import type { Pos, Puzzle } from './types'

export interface HintTargets {
  cells: Pos[]
  rooms: number[]
  suspects: number[]
}

/** What clue pieces name on the board: cells, rooms (for boundaries) and other suspects. */
export function hintTargets(parts: readonly ClueText[], puzzle: Puzzle, subject: number): HintTargets {
  const cells = new Map<string, Pos>()
  const rooms = new Set<number>()
  const suspects = new Set<number>()
  const light = (match: (r: number, c: number) => boolean) => {
    puzzle.cells.forEach((row, r) => row.forEach((_, c) => match(r, c) && cells.set(`${r},${c}`, { r, c })))
  }

  for (const part of parts) {
    if (part.kind === 'object') light((r, c) => puzzle.cells[r][c].object === part.object)
    else if (part.kind === 'room') {
      rooms.add(part.room)
      light((r, c) => puzzle.cells[r][c].room === part.room)
    } else if (part.kind === 'column') light((_, c) => c === part.col)
    else if (part.kind === 'row') light((r) => r === part.row)
    else if (part.kind === 'person' && part.suspect !== subject) suspects.add(part.suspect)
  }
  return { cells: [...cells.values()], rooms: [...rooms], suspects: [...suspects] }
}

/** The union of everything the suspect's clues name. */
export function suspectHints(puzzle: Puzzle, suspect: number): HintTargets {
  const cells = new Map<string, Pos>()
  const rooms = new Set<number>()
  const suspects = new Set<number>()
  for (const clue of puzzle.clues.filter((c) => c.suspect === suspect)) {
    const hint = hintTargets(clueParts(clue, puzzle), puzzle, suspect)
    hint.cells.forEach((p) => cells.set(`${p.r},${p.c}`, p))
    hint.rooms.forEach((room) => rooms.add(room))
    hint.suspects.forEach((s) => suspects.add(s))
  }
  return { cells: [...cells.values()], rooms: [...rooms], suspects: [...suspects] }
}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add highlight targets for clue pieces"
```

---

### Task 3: Board: hint cells, hovered cell, tooltip and room outline

The board takes a `Highlight` and the selected clue text. Highlighted cells are filled, a hovered cell gets a frame and a tooltip (object label, otherwise the room name) plus the selected clue below it, and the hovered cell's room, or the rooms a clue names, is outlined along its outer edges using a CSS variable. Touch pointers never hover. The CSS comes in the next task.

**Files:**
- Create: `src/ui/highlight.ts`
- Modify: `src/ui/Board.tsx`, `src/ui/art/lookup.ts`
- Test: `src/ui/Board.test.tsx`

- [ ] **Step 1: Write the failing tests**

Edit `src/ui/Board.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Board.test.tsx b/src/ui/Board.test.tsx
index 9fb7a7e..771729f 100644
--- a/src/ui/Board.test.tsx
+++ b/src/ui/Board.test.tsx
@@ -6,4 +6,5 @@ import type { PaintMode, ToolDef } from '../engine/plugin'
 import type { Pos } from '../engine/types'
 import { Board } from './Board'
+import type { Highlight } from './highlight'
 
 afterEach(cleanup)
@@ -16,5 +17,13 @@ const SELECT: ToolDef = { id: 'select', label: 'Select' }
 const center = (r: number, c: number) => ({ clientX: c * 100 + 50, clientY: r * 100 + 50 })
 
-function setup(options: { tool?: ToolDef; marks?: string[]; placements?: Record<number, Pos> } = {}) {
+interface SetupOptions {
+  tool?: ToolDef
+  marks?: string[]
+  placements?: Record<number, Pos>
+  highlight?: Highlight
+  selectedClue?: string | null
+}
+
+function setup(options: SetupOptions = {}) {
   const onStroke = vi.fn<(cells: Pos[], mode: PaintMode) => void>()
   const onCellClick = vi.fn<(pos: Pos) => void>()
@@ -27,4 +36,6 @@ function setup(options: { tool?: ToolDef; marks?: string[]; placements?: Record<
       conflicts={new Set()}
       tool={options.tool ?? X}
+      highlight={options.highlight}
+      selectedClue={options.selectedClue}
       onCellClick={onCellClick}
       onStroke={onStroke}
@@ -175,2 +186,78 @@ describe('Board contents', () => {
   })
 })
+
+describe('Board hints', () => {
+  const hint = (cells: string[], rooms: number[] = [], suspects: number[] = []): Highlight => ({
+    cells: new Set(cells),
+    rooms: new Set(rooms),
+    suspects: new Set(suspects),
+  })
+
+  it('fills the highlighted cells and nothing else', () => {
+    setup({ tool: SELECT, highlight: hint(['1,0', '2,1']) })
+    expect(screen.getByTestId('cell-1-0')).toHaveClass('hint')
+    expect(screen.getByTestId('cell-2-1')).toHaveClass('hint')
+    expect(screen.getByTestId('cell-0-0')).not.toHaveClass('hint')
+  })
+
+  it('rings a highlighted suspect token', () => {
+    setup({ tool: SELECT, placements: { 1: { r: 0, c: 1 }, 2: { r: 2, c: 2 } }, highlight: hint([], [], [1]) })
+    expect(screen.getByTestId('cell-0-1').querySelector('.token')).toHaveClass('linked')
+    expect(screen.getByTestId('cell-2-2').querySelector('.token')).not.toHaveClass('linked')
+  })
+
+  it('frames a hovered cell and names its object', () => {
+    setup({ tool: SELECT })
+    fireEvent.pointerEnter(screen.getByTestId('cell-1-0'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-1-0')).toHaveClass('hovered')
+    expect(screen.getByTestId('cell-1-0').querySelector('.tip')).toHaveTextContent('Chair')
+    fireEvent.pointerLeave(screen.getByTestId('cell-1-0'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-1-0')).not.toHaveClass('hovered')
+    expect(document.querySelector('.tip')).toBeNull()
+  })
+
+  it('names the room when the hovered cell holds no object', () => {
+    setup({ tool: SELECT })
+    fireEvent.pointerEnter(screen.getByTestId('cell-0-0'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-0-0').querySelector('.tip')).toHaveTextContent('Hall')
+  })
+
+  it('still frames a blocked cell so it can be styled as unavailable', () => {
+    setup({ tool: SELECT })
+    fireEvent.pointerEnter(screen.getByTestId('cell-1-1'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-1-1')).toHaveClass('hovered')
+    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
+    expect(screen.getByTestId('cell-1-1').querySelector('.tip')).toHaveTextContent('Shelf')
+  })
+
+  it('repeats the selected suspect\'s clue in the tooltip', () => {
+    setup({ tool: SELECT, selectedClue: 'Bob was sitting on a chair.' })
+    fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('Bob was sitting on a chair.')
+  })
+
+  it('ignores touch pointers, which have no hover', () => {
+    setup({ tool: SELECT })
+    fireEvent.pointerEnter(screen.getByTestId('cell-1-0'), { pointerType: 'touch' })
+    expect(screen.getByTestId('cell-1-0')).not.toHaveClass('hovered')
+  })
+
+  it('outlines the room of the hovered cell along its outer edges only', () => {
+    setup({ tool: SELECT })
+    fireEvent.pointerEnter(screen.getByTestId('cell-0-0'), { pointerType: 'mouse' })
+    const corner = screen.getByTestId('cell-0-0')
+    expect(corner).toHaveClass('outlined')
+    const shadow = corner.style.getPropertyValue('--edge-shadow')
+    expect(shadow).toContain('inset 0 4px 0 0')
+    expect(shadow).toContain('inset 4px 0 0 0')
+    expect(shadow).not.toContain('inset -4px')
+    expect(shadow).not.toContain('inset 0 -4px')
+    expect(screen.getByTestId('cell-3-3')).not.toHaveClass('outlined')
+  })
+
+  it('outlines the rooms a clue names, without hovering', () => {
+    setup({ tool: SELECT, highlight: hint([], [3]) })
+    expect(screen.getByTestId('cell-3-3')).toHaveClass('outlined')
+    expect(screen.getByTestId('cell-0-0')).not.toHaveClass('outlined')
+  })
+})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/Board.test.tsx`
Expected: FAIL, the new `Board hints` tests (no `hint`, `hovered` or `outlined` classes, no tooltip).

- [ ] **Step 3: Implement**

Edit `src/ui/Board.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Board.tsx b/src/ui/Board.tsx
index ed0b1f1..1b72791 100644
--- a/src/ui/Board.tsx
+++ b/src/ui/Board.tsx
@@ -5,9 +5,11 @@ import { isOccupiable } from '../engine/types'
 import type { Pos, Puzzle } from '../engine/types'
 import { posKey } from '../state/reducer'
-import { spriteFor } from './art/lookup'
+import { labelFor, spriteFor } from './art/lookup'
 import { portraitFor } from './art/portrait'
 import { Sprite } from './art/Sprite'
 import { roomSurface } from './art/texture'
 import { cellAt, lineCells } from './boardGeometry'
+import { NO_HIGHLIGHT } from './highlight'
+import type { Highlight } from './highlight'
 
 interface BoardProps {
@@ -18,4 +20,6 @@ interface BoardProps {
   conflicts: ReadonlySet<string>
   tool: ToolDef | undefined
+  highlight?: Highlight
+  selectedClue?: string | null
   gridRef?: RefObject<HTMLDivElement | null>
   onCellClick: (pos: Pos) => void
@@ -31,7 +35,36 @@ const THICK = 'var(--wall-thick)'
 const THIN = 'var(--wall-thin)'
 
-export function Board({ puzzle, placements, marks, selected, conflicts, tool, gridRef, onCellClick, onStroke }: BoardProps) {
+const EDGE = '4px'
+
+/** Inset shadows along the sides of a cell that touch another room, for outlining a room. */
+function roomEdges(puzzle: Puzzle, r: number, c: number): string {
+  const room = puzzle.cells[r][c].room
+  const outside = (nr: number, nc: number) => puzzle.cells[nr]?.[nc]?.room !== room
+  return [
+    outside(r - 1, c) ? `inset 0 ${EDGE} 0 0 var(--hint)` : '',
+    outside(r, c + 1) ? `inset -${EDGE} 0 0 0 var(--hint)` : '',
+    outside(r + 1, c) ? `inset 0 -${EDGE} 0 0 var(--hint)` : '',
+    outside(r, c - 1) ? `inset ${EDGE} 0 0 0 var(--hint)` : '',
+  ]
+    .filter(Boolean)
+    .join(', ')
+}
+
+export function Board({
+  puzzle,
+  placements,
+  marks,
+  selected,
+  conflicts,
+  tool,
+  highlight = NO_HIGHLIGHT,
+  selectedClue = null,
+  gridRef,
+  onCellClick,
+  onStroke,
+}: BoardProps) {
   const strokeRef = useRef<Stroke | null>(null)
   const [preview, setPreview] = useState<Stroke | null>(null)
+  const [hovered, setHovered] = useState<Pos | null>(null)
   const paint = tool?.paint
 
@@ -92,4 +125,8 @@ export function Board({ puzzle, placements, marks, selected, conflicts, tool, gr
 
   const previewing = new Set(preview?.cells.map(posKey))
+  const hoveredRoom = hovered ? puzzle.cells[hovered.r][hovered.c].room : null
+  const hover = (pos: Pos | null) => (e: PointerEvent<HTMLElement>) => {
+    if (e.pointerType !== 'touch') setHovered(pos)
+  }
 
   return (
@@ -114,6 +151,11 @@ export function Board({ puzzle, placements, marks, selected, conflicts, tool, gr
           const occupantName = occupant === undefined ? '' : `, ${puzzle.suspects[occupant].name}`
           const label = `Row ${r + 1}, column ${c + 1}, ${puzzle.rooms[cell.room]}${cell.object ? `, ${cell.object}` : ''}${occupantName}`
+          const isHovered = hovered !== null && hovered.r === r && hovered.c === c
+          const outlined = highlight.rooms.has(cell.room) || hoveredRoom === cell.room
           const classes = [
             'cell',
+            highlight.cells.has(key) ? 'hint' : '',
+            isHovered ? 'hovered' : '',
+            outlined ? 'outlined' : '',
             conflicts.has(key) ? 'conflict' : '',
             selected !== null && occupant === selected ? 'picked' : '',
@@ -131,6 +173,9 @@ export function Board({ puzzle, placements, marks, selected, conflicts, tool, gr
               aria-disabled={blocked || undefined}
               className={classes.filter(Boolean).join(' ')}
+              onPointerEnter={hover(pos)}
+              onPointerLeave={hover(null)}
               style={{
                 ...roomSurface(cell.room),
+                ...(outlined ? { ['--edge-shadow' as string]: roomEdges(puzzle, r, c) } : {}),
                 borderTop: differs(r - 1, c) ? THICK : THIN,
                 borderBottom: differs(r + 1, c) ? THICK : THIN,
@@ -154,6 +199,12 @@ export function Board({ puzzle, placements, marks, selected, conflicts, tool, gr
                 </svg>
               )}
+              {isHovered && (
+                <>
+                  <span className="tip">{cell.object ? labelFor(puzzle, cell.object) : puzzle.rooms[cell.room]}</span>
+                  {selectedClue && <span className="tip clue">{selectedClue}</span>}
+                </>
+              )}
               {occupant !== undefined && (
-                <span className="token">
+                <span className={`token${highlight.suspects.has(occupant) ? ' linked' : ''}`}>
                   <Sprite sprite={portraitFor(puzzle.suspects[occupant].name)} />
                 </span>
```

Edit `src/ui/art/lookup.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/art/lookup.ts b/src/ui/art/lookup.ts
index 579fed5..2335cca 100644
--- a/src/ui/art/lookup.ts
+++ b/src/ui/art/lookup.ts
@@ -3,4 +3,6 @@ import { registry } from '../../engine/registry'
 import type { ObjectKind, Puzzle } from '../../engine/types'
 
+export const labelFor = (puzzle: Puzzle, kind: ObjectKind): string => registry.theme(puzzle.themeId).objects[kind].label
+
 export const spriteFor = (puzzle: Puzzle, kind: ObjectKind): SpriteDef =>
   registry.theme(puzzle.themeId).objects[kind].sprite
```

Create `src/ui/highlight.ts`:

```ts
export interface Highlight {
  cells: ReadonlySet<string>
  rooms: ReadonlySet<number>
  suspects: ReadonlySet<number>
}

export const NO_HIGHLIGHT: Highlight = { cells: new Set(), rooms: new Set(), suspects: new Set() }
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add hint highlights, hover frame and tooltip to the board"
```

---

### Task 4: Cards, game wiring and the hint visuals

Suspect cards render clue pieces (bold words, dotted relation words with glossary tooltips), report hover and keyboard focus for the whole card, and show selected and linked states. `Game` makes the active card the hovered one or else the selected one, computes the highlight and the selected clue text, and the CSS draws it all.

**Files:**
- Modify: `src/ui/SuspectPanel.tsx`, `src/ui/Game.tsx`, `src/index.css`
- Test: `src/ui/SuspectPanel.test.tsx`, `src/ui/Game.test.tsx`

- [ ] **Step 1: Write the failing tests**

Edit `src/ui/Game.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.test.tsx b/src/ui/Game.test.tsx
index d4596c3..ccae222 100644
--- a/src/ui/Game.test.tsx
+++ b/src/ui/Game.test.tsx
@@ -233,2 +233,61 @@ describe('Game tools', () => {
   })
 })
+
+describe('Game hints', () => {
+  const hovering = (id: string) => fireEvent.pointerEnter(screen.getByTestId(id), { pointerType: 'mouse' })
+  const leaving = (id: string) => fireEvent.pointerLeave(screen.getByTestId(id).closest('li')!, { pointerType: 'mouse' })
+  const hinted = () => [...document.querySelectorAll('.cell.hint')].map((cell) => cell.getAttribute('data-testid'))
+
+  it('lights what a hovered card names and clears it on leave', () => {
+    renderGame(fakeStorage())
+    hovering('suspect-1')
+    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
+    leaving('suspect-1')
+    expect(hinted()).toEqual([])
+  })
+
+  it('also reacts to the clue card and to keyboard focus', () => {
+    renderGame(fakeStorage())
+    hovering('clue-3')
+    expect(hinted()).toEqual(['cell-3-3'])
+    leaving('clue-3')
+    fireEvent.focus(screen.getByTestId('suspect-1'))
+    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
+    fireEvent.blur(screen.getByTestId('suspect-1'))
+    expect(hinted()).toEqual([])
+  })
+
+  it('keeps the selected card lit after the pointer leaves, and lets hover override it', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    await user.click(screen.getByTestId('suspect-1'))
+    expect(screen.getByTestId('suspect-1').closest('li')).toHaveClass('selected')
+    leaving('suspect-1')
+    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
+    hovering('suspect-3')
+    expect(hinted()).toEqual(['cell-3-3'])
+    leaving('suspect-3')
+    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
+  })
+
+  it('repeats the selected clue when hovering a board cell', async () => {
+    const user = userEvent.setup()
+    renderGame(fakeStorage())
+    await user.click(screen.getByTestId('suspect-1'))
+    fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
+    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('Bob was sitting on a chair.')
+    expect(screen.getByTestId('cell-2-3').querySelector('.tip:not(.clue)')).toHaveTextContent('Garden')
+  })
+
+  it('lights another suspect\'s card, and their token, when a clue names them', async () => {
+    const user = userEvent.setup()
+    const puzzle = { ...tiny, clues: [...tiny.clues, { type: 'northOf', suspect: 0, other: 1, delta: 1 }] }
+    render(<Game puzzle={puzzle} dateKey="2026-10-02" storage={fakeStorage()} now={() => 1_000_000} />)
+    await place(user, 1, 1, 0)
+    hovering('suspect-0')
+    expect(screen.getByTestId('suspect-1').closest('li')).toHaveClass('linked')
+    expect(screen.getByTestId('cell-1-0').querySelector('.token')).toHaveClass('linked')
+    leaving('suspect-0')
+    expect(screen.getByTestId('suspect-1').closest('li')).not.toHaveClass('linked')
+  })
+})
```

Edit `src/ui/SuspectPanel.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/SuspectPanel.test.tsx b/src/ui/SuspectPanel.test.tsx
index b29ae6d..5eccf8b 100644
--- a/src/ui/SuspectPanel.test.tsx
+++ b/src/ui/SuspectPanel.test.tsx
@@ -9,5 +9,13 @@ afterEach(cleanup)
 
 // The board is 400px wide at the origin, so cell (r, c) spans [100c, 100c + 100) x [100r, 100r + 100).
-function setup(options: { placements?: Record<number, Pos>; selected?: number | null; struck?: number[]; failing?: number[] } = {}) {
+interface SetupOptions {
+  placements?: Record<number, Pos>
+  selected?: number | null
+  struck?: number[]
+  failing?: number[]
+  linked?: number[]
+}
+
+function setup(options: SetupOptions = {}) {
   const board = document.createElement('div')
   vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
@@ -15,4 +23,5 @@ function setup(options: { placements?: Record<number, Pos>; selected?: number |
   const onToggleStrike = vi.fn()
   const onDrop = vi.fn()
+  const onHover = vi.fn()
   render(
     <SuspectPanel
@@ -22,11 +31,13 @@ function setup(options: { placements?: Record<number, Pos>; selected?: number |
       struck={options.struck ?? []}
       failing={new Set(options.failing ?? [])}
+      linked={new Set(options.linked ?? [])}
       boardRef={{ current: board }}
       onSelect={onSelect}
       onToggleStrike={onToggleStrike}
       onDrop={onDrop}
+      onHover={onHover}
     />,
   )
-  return { onSelect, onToggleStrike, onDrop }
+  return { onSelect, onToggleStrike, onDrop, onHover }
 }
 
@@ -110,2 +121,49 @@ describe('SuspectPanel dragging', () => {
   })
 })
+
+describe('SuspectPanel hints', () => {
+  it('bolds what a clue names but not the suspect it belongs to', () => {
+    setup()
+    const bold = (id: string) => [...screen.getByTestId(id).querySelectorAll('b')].map((b) => b.textContent)
+    expect(bold('clue-1')).toEqual(['chair'])
+    expect(bold('clue-0')).toEqual(['alone with the killer'])
+  })
+
+  it('explains relation words with the theme glossary', () => {
+    setup()
+    const term = screen.getByTestId('clue-0').querySelector('b.term')!
+    expect(term).toHaveAttribute('data-tip', expect.stringContaining('only two people in the room'))
+  })
+
+  it('reports hover over any part of a card, and leaving it', () => {
+    const { onHover } = setup()
+    const card = screen.getByTestId('suspect-2').closest('li')!
+    fireEvent.pointerEnter(screen.getByTestId('suspect-2').querySelector('.portrait')!, { pointerType: 'mouse' })
+    expect(onHover).toHaveBeenLastCalledWith(2)
+    fireEvent.pointerLeave(card, { pointerType: 'mouse' })
+    expect(onHover).toHaveBeenLastCalledWith(null)
+    fireEvent.pointerEnter(screen.getByTestId('clue-3'), { pointerType: 'mouse' })
+    expect(onHover).toHaveBeenLastCalledWith(3)
+  })
+
+  it('reports keyboard focus inside a card', () => {
+    const { onHover } = setup()
+    fireEvent.focus(screen.getByTestId('clue-1'))
+    expect(onHover).toHaveBeenLastCalledWith(1)
+    fireEvent.blur(screen.getByTestId('clue-1'))
+    expect(onHover).toHaveBeenLastCalledWith(null)
+  })
+
+  it('ignores touch pointers, which have no hover', () => {
+    const { onHover } = setup()
+    fireEvent.pointerEnter(screen.getByTestId('suspect-2'), { pointerType: 'touch' })
+    expect(onHover).not.toHaveBeenCalled()
+  })
+
+  it('marks the selected card and cards named by the active clue', () => {
+    setup({ selected: 2, linked: [3] })
+    expect(screen.getByTestId('suspect-2').closest('li')).toHaveClass('selected')
+    expect(screen.getByTestId('suspect-3').closest('li')).toHaveClass('linked')
+    expect(screen.getByTestId('suspect-1').closest('li')).not.toHaveClass('selected')
+  })
+})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/SuspectPanel.test.tsx`
Expected: FAIL, the new `SuspectPanel hints` tests (no bold words, no hover callbacks, no `selected` or `linked` classes). The `Game` tests also fail until the wiring below is in place.

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
  --hint: #2f6fed;
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
    --hint: #6ea0ff;
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
  .card { flex: 0 0 112px; scroll-snap-align: start; }
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
.card.selected .portrait-card, .card.selected .clue-card { border-color: var(--hint); }
.card.selected .portrait-card { outline: 3px solid var(--hint); outline-offset: 1px; animation: breathe 1.6s ease-in-out infinite; }
.card.selected .plate { color: var(--hint); }
.card.linked .portrait-card { outline: 4px solid var(--hint); outline-offset: 2px; }
.term { position: relative; cursor: help; text-decoration: underline dotted; text-underline-offset: 2px; }
@media (hover: hover) {
  .term:hover::after {
    content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 6px); z-index: 20; width: 14rem;
    padding: 0.4rem 0.55rem; border: 2px solid var(--border); border-radius: 4px; background: var(--card);
    box-shadow: var(--shadow-small); color: var(--ink); font-size: 0.75rem; font-weight: 500; line-height: 1.3;
    text-align: left; text-decoration: none; transform: translateX(-50%); pointer-events: none;
  }
}
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
.cell.hint::after {
  content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: rgba(47, 111, 237, 0.38); box-shadow: inset 0 0 0 3px var(--hint);
}
.cell.outlined::before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; box-shadow: var(--edge-shadow); }
.cell.hovered { z-index: 3; outline: 4px solid #fff; outline-offset: -4px; }
.cell.hovered[aria-disabled='true'] { outline-color: #e5484d; }
.cell .tip {
  position: absolute; left: 50%; bottom: calc(100% + 4px); z-index: 5; padding: 0.15rem 0.5rem; border-radius: 6px;
  background: #14111c; color: #fff; font-size: 0.75rem; font-weight: 700; white-space: nowrap; pointer-events: none;
  transform: translateX(-50%);
}
.cell .tip.clue { top: calc(100% + 4px); bottom: auto; background: #e9e7ee; color: #1f2430; font-weight: 500; }
.cell .token.linked { border-color: var(--hint); box-shadow: 0 0 0 3px var(--hint); }
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
.room-label.end { left: auto; right: 3px; }

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

Edit `src/ui/Game.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.tsx b/src/ui/Game.tsx
index e85baa9..39109d6 100644
--- a/src/ui/Game.tsx
+++ b/src/ui/Game.tsx
@@ -1,4 +1,5 @@
 import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
-import { answerOf, evaluate, isLegalPlacement, isSolved } from '../engine/clues'
+import { answerOf, evaluate, isLegalPlacement, isSolved, renderClue } from '../engine/clues'
+import { suspectHints } from '../engine/hints'
 import { registry } from '../engine/registry'
 import { isOccupiable } from '../engine/types'
@@ -9,4 +10,6 @@ import type { ReadableStorage, WritableStorage } from '../state/storage'
 import { currentStreak, recordSolve } from '../state/streak'
 import { Board } from './Board'
+import { NO_HIGHLIGHT } from './highlight'
+import type { Highlight } from './highlight'
 import { SuspectPanel } from './SuspectPanel'
 import { ToolsPanel } from './ToolsPanel'
@@ -48,4 +51,5 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
   const [accusing, setAccusing] = useState(false)
   const [help, setHelp] = useState(false)
+  const [hovered, setHovered] = useState<number | null>(null)
   const boardRef = useRef<HTMLDivElement | null>(null)
 
@@ -64,4 +68,21 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
   const marks = useMemo(() => new Set(progress.marks), [progress.marks])
   const failing = new Set(check?.key === placementKey ? check.failing : [])
+  const active = hovered ?? selected
+  const highlight = useMemo<Highlight>(() => {
+    if (active === null) return NO_HIGHLIGHT
+    const hint = suspectHints(puzzle, active)
+    return {
+      cells: new Set(hint.cells.map(posKey)),
+      rooms: new Set(hint.rooms),
+      suspects: new Set(hint.suspects),
+    }
+  }, [puzzle, active])
+  const selectedClue =
+    selected === null
+      ? null
+      : puzzle.clues
+          .filter((clue) => clue.suspect === selected)
+          .map((clue) => renderClue(clue, puzzle))
+          .join(' ')
   const readyToAccuse = complete !== null && !solved && isSolved(puzzle, complete)
   const culprit = complete !== null ? answerOf(puzzle, complete) : null
@@ -153,7 +174,9 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
           struck={progress.struck}
           failing={failing}
+          linked={highlight.suspects}
           boardRef={boardRef}
           onSelect={(suspect) => dispatch({ type: 'select', suspect })}
           onToggleStrike={(suspect) => dispatch({ type: 'toggleStrike', suspect })}
+          onHover={setHovered}
           onDrop={(suspect, pos) => {
             if (solved) return
@@ -171,4 +194,6 @@ export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: Gam
             conflicts={conflicts}
             tool={registry.tools().find((t) => t.id === tool)}
+            highlight={highlight}
+            selectedClue={selectedClue}
             gridRef={boardRef}
             onCellClick={onCellClick}
```

Edit `src/ui/SuspectPanel.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/SuspectPanel.tsx b/src/ui/SuspectPanel.tsx
index e63dbaa..4de9a05 100644
--- a/src/ui/SuspectPanel.tsx
+++ b/src/ui/SuspectPanel.tsx
@@ -1,5 +1,7 @@
 import { useEffect, useRef, useState } from 'react'
 import type { PointerEvent, RefObject } from 'react'
-import { renderClue } from '../engine/clues'
+import { clueParts } from '../engine/clues'
+import type { ClueText } from '../engine/plugin'
+import { registry } from '../engine/registry'
 import { isOccupiable } from '../engine/types'
 import type { Pos, Puzzle } from '../engine/types'
@@ -14,8 +16,10 @@ interface SuspectPanelProps {
   struck: readonly number[]
   failing: ReadonlySet<number>
+  linked: ReadonlySet<number>
   boardRef: RefObject<HTMLDivElement | null>
   onSelect: (suspect: number | null) => void
   onToggleStrike: (suspect: number) => void
   onDrop: (suspect: number, pos: Pos) => void
+  onHover: (suspect: number | null) => void
 }
 
@@ -28,4 +32,18 @@ interface Ghost {
 const DRAG_THRESHOLD = 6
 
+function ClueView({ parts, subject, glossary }: { parts: ClueText[]; subject: number; glossary: Readonly<Record<string, string>> }) {
+  return parts.map((part, i) => {
+    if (part.kind === 'text' || (part.kind === 'person' && part.suspect === subject)) return part.text
+    if (part.kind === 'relation') {
+      return (
+        <b key={i} className="term" data-tip={glossary[part.term]}>
+          {part.text}
+        </b>
+      )
+    }
+    return <b key={i}>{part.text}</b>
+  })
+}
+
 export function SuspectPanel({
   puzzle,
@@ -34,15 +52,31 @@ export function SuspectPanel({
   struck,
   failing,
+  linked,
   boardRef,
   onSelect,
   onToggleStrike,
   onDrop,
+  onHover,
 }: SuspectPanelProps) {
   const [ghost, setGhost] = useState<Ghost | null>(null)
   const dragged = useRef(false)
   const stopDrag = useRef<(() => void) | null>(null)
+  const pointerDriven = useRef(false)
+  const glossary = registry.theme(puzzle.themeId).glossary
 
   useEffect(() => () => stopDrag.current?.(), [])
 
+  // A card focused by pointer is already handled by hover and selection; only keyboard focus counts as a hint trigger.
+  useEffect(() => {
+    const byPointer = () => (pointerDriven.current = true)
+    const byKeyboard = () => (pointerDriven.current = false)
+    window.addEventListener('pointerdown', byPointer, true)
+    window.addEventListener('keydown', byKeyboard, true)
+    return () => {
+      window.removeEventListener('pointerdown', byPointer, true)
+      window.removeEventListener('keydown', byKeyboard, true)
+    }
+  }, [])
+
   const beginDrag = (e: PointerEvent<HTMLElement>, suspect: number) => {
     if (e.pointerType === 'mouse' && e.button !== 0) return
@@ -82,5 +116,11 @@ export function SuspectPanel({
           <li
             key={suspect.name}
-            className={`card${placements[i] ? ' placed' : ''}${i === puzzle.victim ? ' victim' : ''}`}
+            className={`card${placements[i] ? ' placed' : ''}${i === puzzle.victim ? ' victim' : ''}${selected === i ? ' selected' : ''}${linked.has(i) ? ' linked' : ''}`}
+            onPointerEnter={(e) => e.pointerType !== 'touch' && onHover(i)}
+            onPointerLeave={(e) => e.pointerType !== 'touch' && onHover(null)}
+            onFocus={() => !pointerDriven.current && onHover(i)}
+            onBlur={(e) => {
+              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(null)
+            }}
           >
             <button
@@ -116,6 +156,10 @@ export function SuspectPanel({
               {puzzle.clues
                 .filter((clue) => clue.suspect === i)
-                .map((clue) => renderClue(clue, puzzle))
-                .join(' ')}
+                .map((clue, n) => (
+                  <span key={n}>
+                    {n > 0 && ' '}
+                    <ClueView parts={clueParts(clue, puzzle)} subject={i} glossary={glossary} />
+                  </span>
+                ))}
             </button>
           </li>
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Wire card hints into the game and style them"
```

---

### Task 5: Browser tests and docs

Playwright covers the real-mouse behavior: hover lights the card's targets and clears on leave, a selected card keeps them and explains cells, and clue terms carry glossary text.

**Files:**
- Modify: `README.md`
- Test: `tests/e2e/hints.spec.ts`

- [ ] **Step 1: Update the README**

Edit `README.md` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/README.md b/README.md
index bb6c7f3..5131983 100644
--- a/README.md
+++ b/README.md
@@ -11,4 +11,6 @@ player, generated entirely in the browser (no backend). Installable as a PWA and
 - The victim was alone with the killer. Once everyone fits, name the killer.
 - Tap a suspect card, then a square, or drag the card onto the grid. Tap a clue to cross it out.
+- Hover a suspect card, or select it, to light up what its clue talks about on the board. Hover a
+  square to see what it is, and a dotted word in a clue to see what it means.
 - Pick the X tool and drag across squares to cross them out. The eraser clears squares; hold it
   to clear the whole board. Undo reverts the last action.
```

- [ ] **Step 2: Add the browser tests**

Create `tests/e2e/hints.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { suspectHints } from '../../src/engine/hints'
import { registerBuiltins } from '../../src/plugins'
import { dailyPuzzle } from '../../src/plugins/classic/daily'

const DAY = '2026-10-02'

registerBuiltins()

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00Z`))
})

test('hovering a card lights what its clue names', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const suspect = puzzle.suspects.findIndex((_, i) => suspectHints(puzzle, i).cells.length > 0)
  const expected = suspectHints(puzzle, suspect).cells.length

  await page.goto('./')
  await page.getByTestId(`suspect-${suspect}`).hover()
  await expect(page.locator('.cell.hint')).toHaveCount(expected)
  await page.mouse.move(1, 1)
  await expect(page.locator('.cell.hint')).toHaveCount(0)
})

test('a selected card keeps its hints and explains cells as you hover them', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const suspect = puzzle.suspects.findIndex((_, i) => suspectHints(puzzle, i).cells.length > 0)
  const expected = suspectHints(puzzle, suspect).cells.length

  await page.goto('./')
  await page.getByTestId(`suspect-${suspect}`).click()
  await page.mouse.move(1, 1)
  await expect(page.locator('.cell.hint')).toHaveCount(expected)

  await page.locator('[data-testid^="cell-"]:not([aria-disabled="true"])').first().hover()
  await expect(page.locator('.tip.clue')).toContainText(`${puzzle.suspects[suspect].name} was`)
})

test('relation words in clues carry a glossary entry', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('b.term').first()).toHaveAttribute('data-tip', /.+/)
})
```

- [ ] **Step 3: Run the browser tests**

Run: `npx playwright test`
Expected: `6 passed`: the three existing tests plus the three new hint tests (Playwright builds and serves the app itself; run `npx playwright install chromium` once if needed).

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add hint browser tests and document hints"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full verification**

```bash
npx tsc -b && npx oxlint && npx vitest run && npm run build && npx playwright test
```

Expected: every command exits 0. Report the test counts you actually see.

- [ ] **Step 2: Look at it**

```bash
npx vite preview --port 4180 --strictPort
```

Open `http://localhost:4180/whodoku/` and check, against the reference behavior in the spec: hovering a card lights its objects, room or other suspects; the card's portrait, name plate and clue all trigger it; selecting a card keeps the highlight when the pointer leaves and gives the card a blue frame and a blue name; hovering a cell frames it in white (red on a table or shelf), names it, outlines its room in blue, and repeats the selected clue; hovering a dotted word in a clue explains it. Stop the server afterwards.

- [ ] **Step 3: Hand back**

Do not merge. Report the branch name, the commit list (`git log --oneline main..clue-hints`) and the verification output, then use superpowers:finishing-a-development-branch.

---

## Self-Review Notes

- **Spec coverage:** active card, hover over the whole card, keyboard focus, selection persistence and hover priority (Task 4); the highlight table for every clue type (Tasks 1 and 2); cell hover frame, red frame, tooltip, room outline and clue repeat (Task 3); glossary tooltips and bold keywords (Tasks 1 and 4); theme glossary validation (Task 1); touch rules (Tasks 3 and 4); browser test (Task 5). Left out per the spec: the killer highlight for the victim's clue, glossary on touch, dimming, translations.
- **Types used across tasks:** `ClueText`, `ClueTypeDef.parts`, `ClueTypeDef.terms`, `ThemeDef.glossary`, `ThemeObject.label` (`src/engine/plugin.ts`); `clueParts` (`src/engine/clues.ts`); `HintTargets`, `hintTargets`, `suspectHints` (`src/engine/hints.ts`); `Highlight`, `NO_HIGHLIGHT` (`src/ui/highlight.ts`); `labelFor` (`src/ui/art/lookup.ts`).
