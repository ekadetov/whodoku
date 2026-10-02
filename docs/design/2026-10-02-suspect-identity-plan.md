# Suspect Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every suspect a pronoun and a recognisable face: clues are worded in the card's voice ("She was beside a plant."), and portraits come from pools that match the pronoun, with eight or more hair styles each, facial hair, glasses, earrings and clothing, and every classic suspect's look pinned so the cast is distinct.

**Architecture:** `Suspect` gains `pronoun` and an optional `look`; themes list suspects as definitions instead of bare names. Clue types start with a plain pronoun piece (and "were" for `they`) instead of a person piece, so the subject neither bolds nor lights its own card. The portrait generator moves into `src/ui/art/portrait/`, split into palette, hair and composition, and exposes `portraitChoices` so what it decided can be tested.

**Tech Stack:** TypeScript 6, React 19, Vitest 5, Playwright. Spec: `docs/design/2026-10-02-suspect-identity-spec.md`.

**Prerequisite:** the clue hints plan (`2026-10-02-clue-hints-plan.md`) is merged. Baseline before starting: `npx tsc -b && npx vitest run` passes (259 tests).

**Conventions for every task:**
- Run commands from the repo root. Commit messages are imperative and short. No Co-Authored-By trailers.
- Code comments only where the reason is non-obvious. ASCII only.
- Each task ends green (`npx tsc -b && npx oxlint && npx vitest run`) and is committed on its own.
- "Edit" blocks are unified diffs against the previous task's result; apply them with your editor or `git apply`. "Create" and "Replace the whole of" blocks are complete files.

**Decisions made while prototyping:**
- `Suspect` in the kernel type carries `pronoun` as a required field; `look` is optional and only meaningful to the UI, but lives with the suspect so themes can pin it as data.
- The clue subject is `{ kind: 'text', text: 'She' }`, not a `person` piece, so `hintTargets` and the card's bolding need no special case for the subject.
- The victim's clue is "The Victim. He was alone with the murderer." The "The Victim." piece is a relation term with a glossary entry, so the theme glossary key `alone with the killer` became `alone with the murderer` and a `victim` key was added.
- The classic theme pins a look for all sixteen suspects; the generator's hash-based choices only fill what a look leaves out, so other themes still get faces for free.
- Visual review was done on a contact sheet of the sixteen suspects plus every hair style and facial hair option, at card size and at token size. Repeat that review if the art is changed.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/types.ts` | `Pronoun`, `PortraitLook`, `Suspect.pronoun` and `Suspect.look` |
| `src/engine/plugin.ts`, `registry.ts` | Themes list suspect definitions; names must be unique |
| `src/plugins/classic/clues.ts` | `who` and `be` helpers; all clue types start with a pronoun |
| `src/plugins/classic/theme.ts` | Pronouns and pinned looks for the sixteen suspects; `victim` and `alone with the murderer` glossary entries |
| `src/ui/art/portrait/palette.ts`, `hair.ts`, `index.ts` | Palettes, hair styles and facial hair, composition and `portraitChoices` |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch and confirm the baseline**

```bash
git switch -c suspect-identity
npx tsc -b && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass; note the count.

---

### Task 1: Suspects with pronouns, and clues in the card's voice

Suspects become `{ name, pronoun, look? }`. Every clue type opens with a pronoun piece and uses "were" for `they`; the victim's clue becomes "The Victim. She was alone with the murderer." The classic theme assigns the sixteen pronouns (including one `they`). Portrait code is untouched here: it still receives the name.

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/plugin.ts`, `src/engine/registry.ts`, `src/engine/fixtures.ts`, `src/plugins/classic/clues.ts`, `src/plugins/classic/theme.ts`, `src/plugins/classic/generator.ts`
- Test: `src/plugins/classic/parts.test.ts`, `src/plugins/classic/clues.test.ts`, `src/engine/registry.test.ts`, `src/plugins/classic/layout.test.ts`, `src/plugins/extensibility.test.ts`, `src/ui/Game.test.tsx`, `src/ui/SuspectPanel.test.tsx`, `tests/e2e/hints.spec.ts`

- [ ] **Step 1: Write the failing tests**

Edit `src/engine/registry.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.test.ts b/src/engine/registry.test.ts
index 0ad3571..f905eb5 100644
--- a/src/engine/registry.test.ts
+++ b/src/engine/registry.test.ts
@@ -8,5 +8,8 @@ const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
   id: 't',
   rooms: ['A', 'B'],
-  suspects: ['X', 'Y'],
+  suspects: [
+    { name: 'X', pronoun: 'she' },
+    { name: 'Y', pronoun: 'he' },
+  ],
   glossary: {},
   objects: {
```

Edit `src/plugins/classic/clues.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/clues.test.ts b/src/plugins/classic/clues.test.ts
index 29b6666..66c7383 100644
--- a/src/plugins/classic/clues.test.ts
+++ b/src/plugins/classic/clues.test.ts
@@ -62,32 +62,32 @@ describe('renderClue', () => {
 
   it('renders room clues', () => {
-    expect(text({ type: 'inRoom', suspect: BOB, room: 2 })).toBe('Bob was in the Kitchen.')
-    expect(text({ type: 'notInRoom', suspect: BOB, room: 2 })).toBe('Bob was not in the Kitchen.')
-    expect(text({ type: 'sameRoomAs', suspect: ANN, other: BOB })).toBe('Ann was in the same room as Bob.')
+    expect(text({ type: 'inRoom', suspect: BOB, room: 2 })).toBe('He was in the Kitchen.')
+    expect(text({ type: 'notInRoom', suspect: BOB, room: 2 })).toBe('He was not in the Kitchen.')
+    expect(text({ type: 'sameRoomAs', suspect: ANN, other: BOB })).toBe('She was in the same room as Bob.')
   })
 
   it('renders object clues', () => {
-    expect(text({ type: 'onObject', suspect: BOB, kind: 'chair' })).toBe('Bob was sitting on a chair.')
-    expect(text({ type: 'notOnObject', suspect: BOB, kind: 'rug' })).toBe('Bob was not on a rug.')
-    expect(text({ type: 'onObject', suspect: DI, kind: 'water' })).toBe('Di was in the water.')
-    expect(text({ type: 'besideObject', suspect: ANN, kind: 'shelf' })).toBe('Ann was beside a shelf.')
-    expect(text({ type: 'notBesideObject', suspect: ANN, kind: 'water' })).toBe('Ann was not beside the water.')
+    expect(text({ type: 'onObject', suspect: BOB, kind: 'chair' })).toBe('He was sitting on a chair.')
+    expect(text({ type: 'notOnObject', suspect: BOB, kind: 'rug' })).toBe('He was not on a rug.')
+    expect(text({ type: 'onObject', suspect: DI, kind: 'water' })).toBe('She was in the water.')
+    expect(text({ type: 'besideObject', suspect: ANN, kind: 'shelf' })).toBe('She was beside a shelf.')
+    expect(text({ type: 'notBesideObject', suspect: ANN, kind: 'water' })).toBe('She was not beside the water.')
     expect(text({ type: 'onlyOnObject', suspect: BOB, kind: 'chair' })).toBe(
-      'Bob was the only person sitting on a chair.',
+      'He was the only person sitting on a chair.',
     )
   })
 
   it('renders position clues with 1-based indices', () => {
-    expect(text({ type: 'inColumn', suspect: ANN, col: 1 })).toBe('Ann was in column 2.')
-    expect(text({ type: 'inRow', suspect: ANN, row: 0 })).toBe('Ann was in row 1.')
-    expect(text({ type: 'northOf', suspect: ANN, other: BOB, delta: 1 })).toBe('Ann was one row north of Bob.')
-    expect(text({ type: 'northOf', suspect: ANN, other: CY, delta: 2 })).toBe('Ann was two rows north of Cy.')
-    expect(text({ type: 'westOf', suspect: BOB, other: ANN, delta: 3 })).toBe('Bob was three columns west of Ann.')
+    expect(text({ type: 'inColumn', suspect: ANN, col: 1 })).toBe('She was in column 2.')
+    expect(text({ type: 'inRow', suspect: ANN, row: 0 })).toBe('She was in row 1.')
+    expect(text({ type: 'northOf', suspect: ANN, other: BOB, delta: 1 })).toBe('She was one row north of Bob.')
+    expect(text({ type: 'northOf', suspect: ANN, other: CY, delta: 2 })).toBe('She was two rows north of Cy.')
+    expect(text({ type: 'westOf', suspect: BOB, other: ANN, delta: 3 })).toBe('He was three columns west of Ann.')
   })
 
   it('renders company clues, special-casing the victim', () => {
-    expect(text({ type: 'aloneInRoom', suspect: BOB })).toBe('Bob was alone.')
-    expect(text({ type: 'withOneOther', suspect: ANN })).toBe('Ann was alone with the killer.')
-    expect(text({ type: 'withOneOther', suspect: BOB })).toBe('Bob was with exactly one other person.')
+    expect(text({ type: 'aloneInRoom', suspect: BOB })).toBe('He was alone.')
+    expect(text({ type: 'withOneOther', suspect: ANN })).toBe('The Victim. She was alone with the murderer.')
+    expect(text({ type: 'withOneOther', suspect: BOB })).toBe('He was with exactly one other person.')
   })
 })
```

Edit `src/plugins/classic/layout.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/layout.test.ts b/src/plugins/classic/layout.test.ts
index 92f9b8c..c209da1 100644
--- a/src/plugins/classic/layout.test.ts
+++ b/src/plugins/classic/layout.test.ts
@@ -64,5 +64,5 @@ describe('generateLayout', () => {
       id: 'mini',
       rooms: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
-      suspects: ['S'],
+      suspects: [{ name: 'S', pronoun: 'they' }],
       glossary: {},
       objects: {
```

Replace the whole of `src/plugins/classic/parts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clueParts, renderClue } from '../../engine/clues'
import { tiny } from '../../engine/fixtures'
import type { ClueText } from '../../engine/plugin'
import type { Clue } from '../../engine/types'
import { classicTheme } from './theme'

const ANN = 0
const BOB = 1
const CY = 2
const DI = 3

const person = (suspect: number): ClueText => ({ kind: 'person', text: tiny.suspects[suspect].name, suspect })
const text = (t: string): ClueText => ({ kind: 'text', text: t })
const she = text('She')
const he = text('He')
const they = text('They')
const not: ClueText = { kind: 'relation', text: 'not', term: 'not' }
const beside: ClueText = { kind: 'relation', text: 'beside', term: 'beside' }

describe('clueParts', () => {
  const cases: [string, Clue, ClueText[]][] = [
    ['inRoom', { type: 'inRoom', suspect: BOB, room: 2 }, [he, text(' was in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')]],
    [
      'notInRoom',
      { type: 'notInRoom', suspect: BOB, room: 2 },
      [he, text(' was '), not, text(' in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')],
    ],
    [
      'onObject keeps the article outside the object',
      { type: 'onObject', suspect: BOB, kind: 'chair' },
      [he, text(' was '), text('sitting on a '), { kind: 'object', text: 'chair', object: 'chair' }, text('.')],
    ],
    [
      'onObject with the water',
      { type: 'onObject', suspect: DI, kind: 'water' },
      [she, text(' was '), text('in the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    [
      'notOnObject',
      { type: 'notOnObject', suspect: BOB, kind: 'rug' },
      [he, text(' was '), not, text(' '), text('on a '), { kind: 'object', text: 'rug', object: 'rug' }, text('.')],
    ],
    [
      'besideObject',
      { type: 'besideObject', suspect: ANN, kind: 'shelf' },
      [she, text(' was '), beside, text(' '), text('a '), { kind: 'object', text: 'shelf', object: 'shelf' }, text('.')],
    ],
    [
      'notBesideObject',
      { type: 'notBesideObject', suspect: ANN, kind: 'water' },
      [she, text(' was '), not, text(' '), beside, text(' '), text('the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    ['inColumn', { type: 'inColumn', suspect: ANN, col: 1 }, [she, text(' was in '), { kind: 'column', text: 'column 2', col: 1 }, text('.')]],
    ['inRow', { type: 'inRow', suspect: ANN, row: 0 }, [she, text(' was in '), { kind: 'row', text: 'row 1', row: 0 }, text('.')]],
    [
      'northOf names the other suspect',
      { type: 'northOf', suspect: ANN, other: BOB, delta: 2 },
      [she, text(' was '), { kind: 'relation', text: 'two rows north of', term: 'north of' }, text(' '), person(BOB), text('.')],
    ],
    [
      'westOf',
      { type: 'westOf', suspect: BOB, other: ANN, delta: 1 },
      [he, text(' was '), { kind: 'relation', text: 'one column west of', term: 'west of' }, text(' '), person(ANN), text('.')],
    ],
    [
      'sameRoomAs',
      { type: 'sameRoomAs', suspect: ANN, other: BOB },
      [she, text(' was in '), { kind: 'relation', text: 'the same room as', term: 'same room' }, text(' '), person(BOB), text('.')],
    ],
    ['aloneInRoom', { type: 'aloneInRoom', suspect: BOB }, [he, text(' was '), { kind: 'relation', text: 'alone', term: 'alone' }, text('.')]],
    [
      'withOneOther',
      { type: 'withOneOther', suspect: BOB },
      [he, text(' was with '), { kind: 'relation', text: 'exactly one other person', term: 'exactly one other' }, text('.')],
    ],
    [
      'withOneOther for the victim',
      { type: 'withOneOther', suspect: ANN },
      [
        { kind: 'relation', text: 'The Victim.', term: 'victim' },
        text(' '),
        she,
        text(' was '),
        { kind: 'relation', text: 'alone with the murderer', term: 'alone with the murderer' },
        text('.'),
      ],
    ],
    [
      'onlyOnObject',
      { type: 'onlyOnObject', suspect: BOB, kind: 'chair' },
      [
        he,
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

  it('uses "were" for a suspect who goes by they', () => {
    expect(clueParts({ type: 'aloneInRoom', suspect: CY }, tiny)).toEqual([
      they,
      text(' were '),
      { kind: 'relation', text: 'alone', term: 'alone' },
      text('.'),
    ])
    expect(renderClue({ type: 'withOneOther', suspect: CY }, tiny)).toBe('They were with exactly one other person.')
    expect(renderClue({ type: 'inRoom', suspect: CY, room: 0 }, tiny)).toBe('They were in the Hall.')
  })

  it('joins into the same sentence renderClue returns', () => {
    for (const [, clue] of cases) {
      expect(renderClue(clue, tiny)).toBe(clueParts(clue, tiny).map((part) => part.text).join(''))
    }
  })
})

describe('classic glossary', () => {
  it('explains every relation term a clue can show', () => {
    const terms = [
      'not',
      'beside',
      'north of',
      'west of',
      'same room',
      'alone',
      'only',
      'exactly one other',
      'victim',
      'alone with the murderer',
    ]
    for (const term of terms) expect(classicTheme.glossary[term]).toBeTruthy()
  })
})
```

Edit `src/plugins/extensibility.test.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/extensibility.test.ts b/src/plugins/extensibility.test.ts
index 8cd8974..d9567ea 100644
--- a/src/plugins/extensibility.test.ts
+++ b/src/plugins/extensibility.test.ts
@@ -21,5 +21,5 @@ const noir: Plugin = {
       id: 'noir',
       rooms: NOIR_ROOMS,
-      suspects: NOIR_SUSPECTS,
+      suspects: NOIR_SUSPECTS.map((name, i) => ({ name, pronoun: i % 2 ? ('he' as const) : ('she' as const) })),
       glossary: classicTheme.glossary,
       objects: {
@@ -53,5 +53,5 @@ describe('extending the engine without touching the kernel', () => {
   it('words clues with the theme nouns', () => {
     const puzzle = { ...tiny, themeId: 'noir' }
-    expect(renderClue({ type: 'onObject', suspect: 1, kind: 'chair' }, puzzle)).toBe('Bob was perched on a barstool.')
+    expect(renderClue({ type: 'onObject', suspect: 1, kind: 'chair' }, puzzle)).toBe('He was perched on a barstool.')
   })
 
```

Edit `src/ui/Game.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Game.test.tsx b/src/ui/Game.test.tsx
index ccae222..e3ee369 100644
--- a/src/ui/Game.test.tsx
+++ b/src/ui/Game.test.tsx
@@ -276,5 +276,5 @@ describe('Game hints', () => {
     await user.click(screen.getByTestId('suspect-1'))
     fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
-    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('Bob was sitting on a chair.')
+    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('He was sitting on a chair.')
     expect(screen.getByTestId('cell-2-3').querySelector('.tip:not(.clue)')).toHaveTextContent('Garden')
   })
```

Edit `src/ui/SuspectPanel.test.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/SuspectPanel.test.tsx b/src/ui/SuspectPanel.test.tsx
index 5eccf8b..65aefe4 100644
--- a/src/ui/SuspectPanel.test.tsx
+++ b/src/ui/SuspectPanel.test.tsx
@@ -54,7 +54,7 @@ describe('SuspectPanel cards', () => {
     expect(screen.getByTestId('suspect-1')).toHaveTextContent('Bob')
     expect(screen.getByTestId('suspect-1').querySelector('.portrait svg')).not.toBeNull()
-    expect(screen.getByTestId('clue-1')).toHaveTextContent('Bob was sitting on a chair.')
+    expect(screen.getByTestId('clue-1')).toHaveTextContent('He was sitting on a chair.')
     expect(screen.getByTestId('suspect-0')).toHaveTextContent('(victim)')
-    expect(screen.getByTestId('clue-0')).toHaveTextContent('Ann was alone with the killer.')
+    expect(screen.getByTestId('clue-0')).toHaveTextContent('The Victim. She was alone with the murderer.')
   })
 
@@ -127,10 +127,10 @@ describe('SuspectPanel hints', () => {
     const bold = (id: string) => [...screen.getByTestId(id).querySelectorAll('b')].map((b) => b.textContent)
     expect(bold('clue-1')).toEqual(['chair'])
-    expect(bold('clue-0')).toEqual(['alone with the killer'])
+    expect(bold('clue-0')).toEqual(['The Victim.', 'alone with the murderer'])
   })
 
   it('explains relation words with the theme glossary', () => {
     setup()
-    const term = screen.getByTestId('clue-0').querySelector('b.term')!
+    const term = [...screen.getByTestId('clue-0').querySelectorAll('b.term')].find((b) => b.textContent === 'alone with the murderer')!
     expect(term).toHaveAttribute('data-tip', expect.stringContaining('only two people in the room'))
   })
```

Edit `tests/e2e/hints.spec.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/tests/e2e/hints.spec.ts b/tests/e2e/hints.spec.ts
index 2938008..58ad6cd 100644
--- a/tests/e2e/hints.spec.ts
+++ b/tests/e2e/hints.spec.ts
@@ -35,5 +35,5 @@ test('a selected card keeps its hints and explains cells as you hover them', asy
 
   await page.locator('[data-testid^="cell-"]:not([aria-disabled="true"])').first().hover()
-  await expect(page.locator('.tip.clue')).toContainText(`${puzzle.suspects[suspect].name} was`)
+  await expect(page.locator('.tip.clue')).toContainText(/^(She|He|They) (was|were)/)
 })
 
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/plugins/classic/parts.test.ts`
Expected: FAIL. Clues still start with the suspect's name, there is no `were` form and no `victim` glossary term.

- [ ] **Step 3: Implement**

Edit `src/engine/fixtures.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/fixtures.ts b/src/engine/fixtures.ts
index d1717d1..1fcb2d9 100644
--- a/src/engine/fixtures.ts
+++ b/src/engine/fixtures.ts
@@ -13,5 +13,10 @@ export const tiny: Puzzle = {
   ],
   rooms: ['Hall', 'Study', 'Kitchen', 'Garden'],
-  suspects: [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cy' }, { name: 'Di' }],
+  suspects: [
+    { name: 'Ann', pronoun: 'she' },
+    { name: 'Bob', pronoun: 'he' },
+    { name: 'Cy', pronoun: 'they' },
+    { name: 'Di', pronoun: 'she' },
+  ],
   victim: 0,
   clues: [
```

Edit `src/engine/plugin.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/plugin.ts b/src/engine/plugin.ts
index f297d8a..d7d5a5f 100644
--- a/src/engine/plugin.ts
+++ b/src/engine/plugin.ts
@@ -1,3 +1,3 @@
-import type { Clue, Placement, Pos, Puzzle } from './types'
+import type { Clue, Placement, Pos, Puzzle, Suspect } from './types'
 
 export type ClueScope = 'unary' | 'binary' | 'global'
@@ -40,5 +40,5 @@ export interface ThemeDef {
   id: string
   rooms: readonly string[]
-  suspects: readonly string[]
+  suspects: readonly Suspect[]
   objects: Readonly<Record<string, ThemeObject>>
   /** One-line explanations for the relation words clues use, keyed by `ClueText` term. */
```

Edit `src/engine/registry.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/registry.ts b/src/engine/registry.ts
index 795425a..352e276 100644
--- a/src/engine/registry.ts
+++ b/src/engine/registry.ts
@@ -58,5 +58,5 @@ export function validateTheme(theme: ThemeDef, kinds: ReadonlyMap<string, Object
     fail('rooms must be non-empty and unique')
   }
-  if (theme.suspects.length === 0 || new Set(theme.suspects).size !== theme.suspects.length) {
+  if (theme.suspects.length === 0 || new Set(theme.suspects.map((s) => s.name)).size !== theme.suspects.length) {
     fail('suspects must be non-empty and unique')
   }
```

Edit `src/engine/types.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/engine/types.ts b/src/engine/types.ts
index 39e721f..cf7e3a1 100644
--- a/src/engine/types.ts
+++ b/src/engine/types.ts
@@ -13,6 +13,20 @@ export interface Cell {
 }
 
+export type Pronoun = 'she' | 'he' | 'they'
+
+/** Pins any part of a generated portrait; whatever is left out is chosen from the name. */
+export interface PortraitLook {
+  hairStyle?: string
+  hairColor?: string
+  skin?: string
+  facialHair?: string
+  shirt?: string
+  glasses?: boolean
+}
+
 export interface Suspect {
   name: string
+  pronoun: Pronoun
+  look?: PortraitLook
 }
 
```

Edit `src/plugins/classic/clues.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/clues.ts b/src/plugins/classic/clues.ts
index e7db4e1..26978a0 100644
--- a/src/plugins/classic/clues.ts
+++ b/src/plugins/classic/clues.ts
@@ -61,4 +61,10 @@ const text = (value: string): ClueText => ({ kind: 'text', text: value })
 const relation = (value: string, term: string): ClueText => ({ kind: 'relation', text: value, term })
 const person = (puzzle: Puzzle, suspect: number): ClueText => ({ kind: 'person', text: nameOf(puzzle, suspect), suspect })
+
+const PRONOUNS = { she: 'She', he: 'He', they: 'They' } as const
+
+/** The card already shows the name, so a clue's subject is a plain pronoun (not a person piece). */
+const who = (puzzle: Puzzle, suspect: number): ClueText => text(PRONOUNS[puzzle.suspects[suspect].pronoun])
+const be = (puzzle: Puzzle, suspect: number): string => (puzzle.suspects[suspect].pronoun === 'they' ? 'were' : 'was')
 const roomText = (puzzle: Puzzle, room: number): ClueText => ({ kind: 'room', text: puzzle.rooms[room], room })
 
@@ -89,6 +95,6 @@ const inRoom: ClueTypeDef = {
   evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) === clue.room,
   parts: (clue: RoomClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was in the '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} in the `),
     roomText(puzzle, clue.room),
     text('.'),
@@ -103,6 +109,6 @@ const notInRoom: ClueTypeDef = {
   terms: ['not'],
   parts: (clue: RoomClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation('not', 'not'),
     text(' in the '),
@@ -118,6 +124,6 @@ const onObject: ClueTypeDef = {
   evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) === clue.kind,
   parts: (clue: KindClue, puzzle, theme) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     ...standingParts(theme, clue.kind),
     text('.'),
@@ -132,6 +138,6 @@ const notOnObject: ClueTypeDef = {
   terms: ['not'],
   parts: (clue: KindClue, puzzle, theme) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation('not', 'not'),
     text(' '),
@@ -148,6 +154,6 @@ const besideObject: ClueTypeDef = {
   terms: ['beside'],
   parts: (clue: KindClue, puzzle, theme) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation('beside', 'beside'),
     text(' '),
@@ -164,6 +170,6 @@ const notBesideObject: ClueTypeDef = {
   terms: ['not', 'beside'],
   parts: (clue: KindClue, puzzle, theme) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation('not', 'not'),
     text(' '),
@@ -181,6 +187,6 @@ const inColumn: ClueTypeDef = {
   evaluate: (clue: ColumnClue, _puzzle, placement) => placement[clue.suspect].c === clue.col,
   parts: (clue: ColumnClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was in '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} in `),
     { kind: 'column', text: `column ${clue.col + 1}`, col: clue.col },
     text('.'),
@@ -194,6 +200,6 @@ const inRow: ClueTypeDef = {
   evaluate: (clue: RowClue, _puzzle, placement) => placement[clue.suspect].r === clue.row,
   parts: (clue: RowClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was in '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} in `),
     { kind: 'row', text: `row ${clue.row + 1}`, row: clue.row },
     text('.'),
@@ -208,6 +214,6 @@ const northOf: ClueTypeDef = {
   terms: ['north of'],
   parts: (clue: OffsetClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation(`${plural(clue.delta, 'row')} north of`, 'north of'),
     text(' '),
@@ -229,6 +235,6 @@ const westOf: ClueTypeDef = {
   terms: ['west of'],
   parts: (clue: OffsetClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation(`${plural(clue.delta, 'column')} west of`, 'west of'),
     text(' '),
@@ -251,6 +257,6 @@ const sameRoomAs: ClueTypeDef = {
   terms: ['same room'],
   parts: (clue: OtherClue, puzzle) => [
-    person(puzzle, clue.suspect),
-    text(' was in '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} in `),
     relation('the same room as', 'same room'),
     text(' '),
@@ -268,5 +274,10 @@ const aloneInRoom: ClueTypeDef = {
     suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 1,
   terms: ['alone'],
-  parts: (clue, puzzle) => [person(puzzle, clue.suspect), text(' was '), relation('alone', 'alone'), text('.')],
+  parts: (clue, puzzle) => [
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
+    relation('alone', 'alone'),
+    text('.'),
+  ],
   candidates: bare('aloneInRoom'),
   prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 1,
@@ -278,16 +289,18 @@ const withOneOther: ClueTypeDef = {
   evaluate: (clue, puzzle, placement) =>
     suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 2,
-  terms: ['alone with the killer', 'exactly one other'],
+  terms: ['victim', 'alone with the murderer', 'exactly one other'],
   parts: (clue, puzzle) =>
     clue.suspect === puzzle.victim
       ? [
-          person(puzzle, clue.suspect),
-          text(' was '),
-          relation('alone with the killer', 'alone with the killer'),
+          relation('The Victim.', 'victim'),
+          text(' '),
+          who(puzzle, clue.suspect),
+          text(` ${be(puzzle, clue.suspect)} `),
+          relation('alone with the murderer', 'alone with the murderer'),
           text('.'),
         ]
       : [
-          person(puzzle, clue.suspect),
-          text(' was with '),
+          who(puzzle, clue.suspect),
+          text(` ${be(puzzle, clue.suspect)} with `),
           relation('exactly one other person', 'exactly one other'),
           text('.'),
@@ -312,6 +325,6 @@ const onlyOnObject: ClueTypeDef = {
   terms: ['only'],
   parts: (clue: KindClue, puzzle, theme) => [
-    person(puzzle, clue.suspect),
-    text(' was '),
+    who(puzzle, clue.suspect),
+    text(` ${be(puzzle, clue.suspect)} `),
     relation('the only person', 'only'),
     text(' '),
```

Edit `src/plugins/classic/generator.ts` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/plugins/classic/generator.ts b/src/plugins/classic/generator.ts
index 2e72ddf..1474a47 100644
--- a/src/plugins/classic/generator.ts
+++ b/src/plugins/classic/generator.ts
@@ -187,5 +187,5 @@ function attemptPuzzle(rng: Rng, config: TierConfig, theme: ThemeDef): Puzzle |
     suspects: shuffle(rng, theme.suspects)
       .slice(0, size)
-      .map((name) => ({ name })),
+      .map((suspect) => ({ ...suspect })),
     victim: pick(rng, eligible),
     clues: [],
```

Replace the whole of `src/plugins/classic/theme.ts`:

```ts
import type { ThemeDef } from '../../engine/plugin'
import { SPRITES } from './sprites'

export const classicTheme: ThemeDef = {
  id: 'classic',
  rooms: [
    'Library',
    'Kitchen',
    'Cellar',
    'Attic',
    'Garden',
    'Study',
    'Gallery',
    'Conservatory',
    'Parlor',
    'Workshop',
    'Pantry',
    'Balcony',
    'Laundry',
    'Cloakroom',
    'Observatory',
    'Chapel',
  ],
  suspects: [
    { name: 'Ada', pronoun: 'she' },
    { name: 'Bram', pronoun: 'he' },
    { name: 'Cora', pronoun: 'she' },
    { name: 'Dev', pronoun: 'he' },
    { name: 'Elsa', pronoun: 'she' },
    { name: 'Finn', pronoun: 'he' },
    { name: 'Gus', pronoun: 'he' },
    { name: 'Hana', pronoun: 'she' },
    { name: 'Ivo', pronoun: 'he' },
    { name: 'June', pronoun: 'she' },
    { name: 'Kai', pronoun: 'they' },
    { name: 'Lena', pronoun: 'she' },
    { name: 'Milo', pronoun: 'he' },
    { name: 'Nora', pronoun: 'she' },
    { name: 'Otto', pronoun: 'he' },
    { name: 'Pia', pronoun: 'she' },
  ],
  objects: {
    chair: { label: 'Chair', noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
    rug: { label: 'Rug', noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
    water: { label: 'Water', noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
    table: { label: 'Table', noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
    shelf: { label: 'Shelf', noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
    plant: { label: 'Plant', noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
    rock: { label: 'Rock', noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
    tree: { label: 'Tree', noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
    tv: { label: 'TV', noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
  },
  glossary: {
    not: 'The opposite is true: this is where they were not.',
    beside: 'Directly left, right, above or below something, in the same room. Diagonals do not count.',
    'north of': 'In a row above, counting rows from the top of the board. The number says how many rows apart.',
    'west of': 'In a column to the left. The number says how many columns apart.',
    'same room': 'Both were inside the same room, in different squares.',
    alone: 'Nobody else was in the same room.',
    only: 'Nobody else stood on that kind of object.',
    'exactly one other': 'Exactly two people, counting them, were in the room.',
    victim: 'The person who was murdered. Their clue says who they were with.',
    'alone with the murderer': 'The victim and the murderer were the only two people in the room.',
  },
}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give suspects pronouns and word clues in the card's voice"
```

---

### Task 2: Portraits that follow the pronoun

The portrait generator is rebuilt: palettes, eight or more hair styles per pronoun pool, facial hair, glasses, earrings, ears, face shapes and clothing (tee, collared, plaid, hoodie, blouse). `portraitChoices` exposes what was decided so tests can check it; `portraitFor` takes the whole suspect. The classic theme pins a look for every suspect so no two share a hair style and colour.

**Files:**
- Create: `src/ui/art/portrait/palette.ts`, `src/ui/art/portrait/hair.ts`, `src/ui/art/portrait/index.ts`
- Delete: `src/ui/art/portrait.ts`, `src/ui/art/portrait.test.ts`
- Modify: `src/ui/Board.tsx`, `src/ui/SuspectPanel.tsx`, `src/plugins/classic/theme.ts`
- Test: `src/ui/art/portrait/portrait.test.ts`, `src/ui/art/portrait/classicLooks.test.ts`

- [ ] **Step 1: Write the failing tests**

Delete `src/ui/art/portrait.test.ts`:

```bash
git rm src/ui/art/portrait.test.ts
```

Create `src/ui/art/portrait/classicLooks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classicTheme } from '../../../plugins/classic/theme'
import { STYLE_POOLS } from './hair'

describe('classic suspects', () => {
  it('each have a pinned hair style and colour, with no two alike', () => {
    expect(classicTheme.suspects.every((s) => s.look?.hairStyle && s.look.hairColor)).toBe(true)
    const pairs = classicTheme.suspects.map((s) => `${s.look?.hairStyle}/${s.look?.hairColor}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('use hair styles that fit their pronoun', () => {
    for (const s of classicTheme.suspects) expect(STYLE_POOLS[s.pronoun]).toContain(s.look?.hairStyle)
  })

  it('give she no facial hair', () => {
    for (const s of classicTheme.suspects.filter((x) => x.pronoun === 'she')) {
      expect(s.look?.facialHair ?? 'none').toBe('none')
    }
  })
})
```

Create `src/ui/art/portrait/portrait.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Pronoun, Suspect } from '../../../engine/types'
import { FACIAL_HAIR_POOLS, HAIR_STYLES, STYLE_POOLS } from './hair'
import { portraitChoices, portraitFor } from '.'

const NAMES = ['Ada', 'Bram', 'Cora', 'Dev', 'Elsa', 'Finn', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lena']
const suspect = (name: string, pronoun: Pronoun): Suspect => ({ name, pronoun })
const many = (pronoun: Pronoun) => Array.from({ length: 80 }, (_, i) => suspect(`Person${i}`, pronoun))

describe('portraitFor', () => {
  it('is deterministic for a suspect', () => {
    expect(portraitFor(suspect('Ada', 'she'))).toEqual(portraitFor(suspect('Ada', 'she')))
  })

  it('gives different people different faces', () => {
    const faces = new Set(NAMES.map((name, i) => JSON.stringify(portraitFor(suspect(name, i % 2 ? 'he' : 'she')))))
    expect(faces.size).toBe(NAMES.length)
  })

  it('draws a background first and plain shapes only', () => {
    const { shapes } = portraitFor(suspect('Ada', 'she'))
    expect(shapes[0].kind).toBe('rect')
    expect(shapes.length).toBeGreaterThanOrEqual(8)
    for (const shape of shapes) expect(['rect', 'ellipse', 'path']).toContain(shape.kind)
  })
})

describe('portrait styles', () => {
  it('has a drawing for every style in every pool, and at least eight for she and he', () => {
    for (const pronoun of ['she', 'he', 'they'] as Pronoun[]) {
      for (const style of STYLE_POOLS[pronoun]) expect(HAIR_STYLES[style]).toBeTypeOf('function')
    }
    expect(STYLE_POOLS.she.length).toBeGreaterThanOrEqual(8)
    expect(STYLE_POOLS.he.length).toBeGreaterThanOrEqual(8)
  })

  it('keeps she and he apart: no facial hair for she, no she-only styles for he', () => {
    for (const s of many('she')) {
      const c = portraitChoices(s)
      expect(c.facialHair).toBe('none')
      expect(STYLE_POOLS.she).toContain(c.hairStyle)
    }
    const sheOnly = STYLE_POOLS.she.filter((style) => !STYLE_POOLS.they.includes(style))
    for (const s of many('he')) expect(sheOnly).not.toContain(portraitChoices(s).hairStyle)
    expect(new Set(many('he').map((s) => portraitChoices(s).facialHair)).size).toBeGreaterThan(2)
  })

  it('lets they draw from both sides', () => {
    expect(FACIAL_HAIR_POOLS.they).toContain('none')
    const styles = new Set(many('they').map((s) => portraitChoices(s).hairStyle))
    expect(styles.size).toBeGreaterThan(5)
  })

  it('honours every pinned part of a look', () => {
    const look = { hairStyle: 'bun', hairColor: '#123456', skin: '#654321', facialHair: 'goatee', shirt: '#abcdef', glasses: true }
    const c = portraitChoices({ name: 'Pinned', pronoun: 'she', look })
    expect(c).toMatchObject(look)
  })

  it('fills in whatever the look leaves out', () => {
    const c = portraitChoices({ name: 'Partial', pronoun: 'he', look: { hairStyle: 'bald' } })
    expect(c.hairStyle).toBe('bald')
    expect(c.skin).toMatch(/^#/)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/art/portrait`
Expected: FAIL, cannot resolve `./hair` and `.`; the classic suspects have no pinned looks.

- [ ] **Step 3: Implement**

Replace the whole of `src/plugins/classic/theme.ts`:

```ts
import type { ThemeDef } from '../../engine/plugin'
import { SPRITES } from './sprites'

export const classicTheme: ThemeDef = {
  id: 'classic',
  rooms: [
    'Library',
    'Kitchen',
    'Cellar',
    'Attic',
    'Garden',
    'Study',
    'Gallery',
    'Conservatory',
    'Parlor',
    'Workshop',
    'Pantry',
    'Balcony',
    'Laundry',
    'Cloakroom',
    'Observatory',
    'Chapel',
  ],
  suspects: [
    {
      name: 'Ada',
      pronoun: 'she',
      look: { hairStyle: 'longStraight', hairColor: '#e0c068', skin: '#fbdcc4', shirt: '#8a8fa8', glasses: true },
    },
    {
      name: 'Bram',
      pronoun: 'he',
      look: { hairStyle: 'sidePart', hairColor: '#2b1d16', skin: '#8f5a3a', shirt: '#2f6f6f', facialHair: 'fullBeard' },
    },
    {
      name: 'Cora',
      pronoun: 'she',
      look: { hairStyle: 'longWavy', hairColor: '#6b4423', skin: '#e5b48a', shirt: '#3f7fbf' },
    },
    {
      name: 'Dev',
      pronoun: 'he',
      look: { hairStyle: 'quiff', hairColor: '#1c1c24', skin: '#b57a4e', shirt: '#d95f7a' },
    },
    {
      name: 'Elsa',
      pronoun: 'she',
      look: { hairStyle: 'bun', hairColor: '#2b1d16', skin: '#f2c6a0', shirt: '#9b6bc9' },
    },
    {
      name: 'Finn',
      pronoun: 'he',
      look: { hairStyle: 'short', hairColor: '#c1442e', skin: '#fbdcc4', shirt: '#3f7fbf', facialHair: 'stubble' },
    },
    {
      name: 'Gus',
      pronoun: 'he',
      look: { hairStyle: 'buzz', hairColor: '#1c1c24', skin: '#6e4129', shirt: '#e0872e', glasses: true },
    },
    {
      name: 'Hana',
      pronoun: 'she',
      look: { hairStyle: 'bob', hairColor: '#d9742a', skin: '#e5b48a', shirt: '#8a8fa8' },
    },
    {
      name: 'Ivo',
      pronoun: 'he',
      look: { hairStyle: 'curlyTop', hairColor: '#2b1d16', skin: '#4f2e1e', shirt: '#8a8fa8', facialHair: 'moustache' },
    },
    {
      name: 'June',
      pronoun: 'she',
      look: { hairStyle: 'ponytail', hairColor: '#8a5a2b', skin: '#d09a6c', shirt: '#9b6bc9' },
    },
    {
      name: 'Kai',
      pronoun: 'they',
      look: { hairStyle: 'pixie', hairColor: '#b8b8c0', skin: '#fbdcc4', shirt: '#8a8fa8' },
    },
    {
      name: 'Lena',
      pronoun: 'she',
      look: { hairStyle: 'curls', hairColor: '#b8b8c0', skin: '#8f5a3a', shirt: '#c9b04a', glasses: true },
    },
    {
      name: 'Milo',
      pronoun: 'he',
      look: { hairStyle: 'slick', hairColor: '#c68a3a', skin: '#e5b48a', shirt: '#4fa68a', facialHair: 'goatee' },
    },
    {
      name: 'Nora',
      pronoun: 'she',
      look: { hairStyle: 'puff', hairColor: '#1c1c24', skin: '#6e4129', shirt: '#d95f7a' },
    },
    {
      name: 'Otto',
      pronoun: 'he',
      look: { hairStyle: 'receding', hairColor: '#e8e8ee', skin: '#f2c6a0', shirt: '#e0872e', facialHair: 'fullBeard', glasses: true },
    },
    {
      name: 'Pia',
      pronoun: 'she',
      look: { hairStyle: 'longStraight', hairColor: '#1c1c24', skin: '#f2c6a0', shirt: '#4fa68a' },
    },
  ],
  objects: {
    chair: { label: 'Chair', noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
    rug: { label: 'Rug', noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
    water: { label: 'Water', noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
    table: { label: 'Table', noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
    shelf: { label: 'Shelf', noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
    plant: { label: 'Plant', noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
    rock: { label: 'Rock', noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
    tree: { label: 'Tree', noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
    tv: { label: 'TV', noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
  },
  glossary: {
    not: 'The opposite is true: this is where they were not.',
    beside: 'Directly left, right, above or below something, in the same room. Diagonals do not count.',
    'north of': 'In a row above, counting rows from the top of the board. The number says how many rows apart.',
    'west of': 'In a column to the left. The number says how many columns apart.',
    'same room': 'Both were inside the same room, in different squares.',
    alone: 'Nobody else was in the same room.',
    only: 'Nobody else stood on that kind of object.',
    'exactly one other': 'Exactly two people, counting them, were in the room.',
    victim: 'The person who was murdered. Their clue says who they were with.',
    'alone with the murderer': 'The victim and the murderer were the only two people in the room.',
  },
}
```

Edit `src/ui/Board.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/Board.tsx b/src/ui/Board.tsx
index 1b72791..9f0bfd1 100644
--- a/src/ui/Board.tsx
+++ b/src/ui/Board.tsx
@@ -207,5 +207,5 @@ export function Board({
               {occupant !== undefined && (
                 <span className={`token${highlight.suspects.has(occupant) ? ' linked' : ''}`}>
-                  <Sprite sprite={portraitFor(puzzle.suspects[occupant].name)} />
+                  <Sprite sprite={portraitFor(puzzle.suspects[occupant])} />
                 </span>
               )}
```

Edit `src/ui/SuspectPanel.tsx` (unified diff; apply with the editor or `git apply`):

```diff
diff --git a/src/ui/SuspectPanel.tsx b/src/ui/SuspectPanel.tsx
index 4de9a05..a2225bb 100644
--- a/src/ui/SuspectPanel.tsx
+++ b/src/ui/SuspectPanel.tsx
@@ -139,5 +139,5 @@ export function SuspectPanel({
             >
               <span className="portrait">
-                <Sprite sprite={portraitFor(suspect.name)} />
+                <Sprite sprite={portraitFor(suspect)} />
               </span>
               <span className="plate">
@@ -168,5 +168,5 @@ export function SuspectPanel({
       {ghost && (
         <div className="ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
-          <Sprite sprite={portraitFor(puzzle.suspects[ghost.suspect].name)} />
+          <Sprite sprite={portraitFor(puzzle.suspects[ghost.suspect])} />
         </div>
       )}
```

Delete `src/ui/art/portrait.ts`:

```bash
git rm src/ui/art/portrait.ts
```

Create `src/ui/art/portrait/hair.ts`:

```ts
import type { SpriteShape } from '../../../engine/plugin'
import type { Pronoun } from '../../../engine/types'
import { INK } from './palette'

export interface HairLayers {
  /** Drawn behind the neck and face, over the shoulders. */
  back: SpriteShape[]
  /** Drawn over the face. */
  front: SpriteShape[]
  /** Whether the ears stay visible. */
  ears: boolean
}

const path = (d: string, fill: string, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke: INK, sw })
const blob = (cx: number, cy: number, r: number, fill: string): SpriteShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx: r,
  ry: r,
  fill,
  stroke: INK,
  sw: 3,
})

const CAP = 'M31 36 C29 20 40 12 52 12 C66 12 73 22 69 38 C64 28 56 24 46 26 C40 28 34 32 31 36 Z'

export const HAIR_STYLES: Record<string, (c: string) => HairLayers> = {
  longStraight: (c) => ({
    back: [path('M26 50 C22 16 38 8 50 8 C62 8 78 16 74 50 L77 84 C70 88 62 86 58 82 L42 82 C38 86 30 88 23 84 Z', c)],
    front: [path('M30 38 C30 20 42 13 52 13 C64 13 72 22 70 38 C64 28 56 24 46 26 C40 28 34 32 30 38 Z', c)],
    ears: false,
  }),
  longWavy: (c) => ({
    back: [
      path(
        'M26 50 C20 16 38 8 50 8 C62 8 80 16 74 50 C80 60 76 70 80 78 C76 86 70 80 66 86 C62 80 58 86 54 80 L46 80 C42 86 38 80 34 86 C30 80 24 86 20 78 C24 70 20 60 26 50 Z',
        c,
      ),
    ],
    front: [path('M30 38 C30 20 42 13 52 13 C64 13 72 22 70 38 C64 28 56 24 46 26 C40 28 34 32 30 38 Z', c)],
    ears: false,
  }),
  bob: (c) => ({
    back: [path('M25 46 C22 14 38 9 50 9 C62 9 78 14 75 46 L75 64 C68 68 62 62 60 58 L40 58 C38 62 32 68 25 64 Z', c)],
    front: [path('M30 36 C30 20 41 14 50 14 C62 14 71 20 70 36 C62 30 38 30 30 36 Z', c)],
    ears: false,
  }),
  curls: (c) => ({
    back: [
      blob(26, 40, 10, c), blob(74, 40, 10, c), blob(28, 58, 9, c), blob(72, 58, 9, c),
      blob(34, 24, 10, c), blob(66, 24, 10, c), blob(50, 17, 11, c),
    ],
    front: [blob(40, 24, 8, c), blob(52, 20, 8, c), blob(62, 26, 7, c)],
    ears: false,
  }),
  bun: (c) => ({
    back: [blob(50, 9, 10, c)],
    front: [path(CAP, c)],
    ears: true,
  }),
  ponytail: (c) => ({
    back: [path('M68 28 C86 26 92 48 84 66 C80 74 72 70 76 58 C78 48 74 38 66 34 Z', c)],
    front: [path(CAP, c)],
    ears: true,
  }),
  pixie: (c) => ({
    back: [],
    front: [path('M31 40 C27 18 42 9 54 10 C68 11 75 22 70 38 C66 26 56 22 44 26 C36 29 32 32 31 40 Z', c)],
    ears: true,
  }),
  puff: (c) => ({
    back: [{ kind: 'ellipse', cx: 50, cy: 26, rx: 28, ry: 24, fill: c, stroke: INK, sw: 3 }],
    front: [path('M32 38 C32 28 40 24 50 24 C60 24 68 28 68 38 C62 32 38 32 32 38 Z', c)],
    ears: true,
  }),
  short: (c) => ({ back: [], front: [path(CAP, c)], ears: true }),
  sidePart: (c) => ({
    back: [],
    front: [
      path('M31 38 C28 18 44 10 56 12 C68 14 72 26 69 38 C62 24 50 22 40 28 C36 31 33 34 31 38 Z', c),
      path('M44 26 C48 18 54 14 58 13', c, 2),
    ],
    ears: true,
  }),
  buzz: (c) => ({
    back: [],
    front: [path('M32 34 C30 21 40 16 50 16 C60 16 70 21 68 34 C60 25 40 25 32 34 Z', c, 2)],
    ears: true,
  }),
  curlyTop: (c) => ({
    back: [],
    front: [blob(36, 24, 8, c), blob(46, 17, 9, c), blob(58, 17, 9, c), blob(67, 25, 8, c), blob(51, 24, 8, c)],
    ears: true,
  }),
  receding: (c) => ({
    back: [],
    front: [
      path('M31 42 C28 30 32 22 39 19 C37 28 37 35 39 42 Z', c),
      path('M69 42 C72 30 68 22 61 19 C63 28 63 35 61 42 Z', c),
      path('M39 19 C46 12 56 12 61 19 C56 16 44 16 39 19 Z', c),
    ],
    ears: true,
  }),
  bald: () => ({ back: [], front: [], ears: true }),
  quiff: (c) => ({
    back: [],
    front: [
      path('M31 38 C26 18 38 6 54 8 C70 10 76 24 69 38 C66 26 56 20 46 24 C38 27 33 32 31 38 Z', c),
      path('M40 22 C46 12 56 10 64 14', c, 2),
    ],
    ears: true,
  }),
  slick: (c) => ({
    back: [],
    front: [path('M31 38 C29 22 40 14 52 14 C66 14 73 24 69 38 C66 30 56 26 50 26 C42 26 34 30 31 38 Z', c), path('M38 22 C46 18 56 18 64 22', c, 2)],
    ears: true,
  }),
}

export const STYLE_POOLS: Record<Pronoun, readonly string[]> = {
  she: ['longStraight', 'longWavy', 'bob', 'curls', 'bun', 'ponytail', 'pixie', 'puff'],
  he: ['short', 'sidePart', 'buzz', 'curlyTop', 'receding', 'bald', 'quiff', 'slick'],
  they: ['longStraight', 'bob', 'curls', 'bun', 'pixie', 'puff', 'short', 'sidePart', 'buzz', 'curlyTop', 'quiff', 'slick'],
}

export function facialHair(kind: string, c: string): SpriteShape[] {
  const mustache = path('M39 53 C43 49 48 50 50 53 C52 50 57 49 61 53 C57 57 43 57 39 53 Z', c, 2)
  switch (kind) {
    case 'stubble':
      return [{ kind: 'path', d: 'M32 46 C33 70 67 70 68 46 C62 60 38 60 32 46 Z', fill: c, stroke: 'none', sw: 0 }]
    case 'moustache':
      return [mustache]
    case 'goatee':
      return [mustache, path('M44 60 C46 68 54 68 56 60 C54 63 46 63 44 60 Z', c, 2)]
    case 'fullBeard':
      return [path('M31 44 C30 72 70 72 69 44 C66 58 56 60 50 60 C44 60 34 58 31 44 Z', c), mustache]
    default:
      return []
  }
}

export const FACIAL_HAIR_POOLS: Record<Pronoun, readonly string[]> = {
  she: ['none'],
  he: ['none', 'none', 'stubble', 'moustache', 'goatee', 'fullBeard'],
  they: ['none', 'none', 'none', 'stubble'],
}
```

Create `src/ui/art/portrait/index.ts`:

```ts
import type { SpriteDef, SpriteShape } from '../../../engine/plugin'
import { hashSeed, mulberry32, pick } from '../../../engine/rng'
import type { Suspect } from '../../../engine/types'
import { FACIAL_HAIR_POOLS, HAIR_STYLES, STYLE_POOLS, facialHair } from './hair'
import { BACKGROUNDS, HAIRS, INK, SHIRTS, SKINS } from './palette'

const SHOULDERS = {
  she: 'M12 100 C12 82 26 74 44 72 L56 72 C74 74 88 82 88 100 Z',
  he: 'M4 100 C4 80 22 72 42 70 L58 70 C78 72 96 80 96 100 Z',
  they: 'M8 100 C8 81 24 73 43 71 L57 71 C76 73 92 81 92 100 Z',
} as const

const FACES = {
  round: 'M31 40 C31 24 40 18 50 18 C60 18 69 24 69 40 C69 56 60 66 50 66 C40 66 31 56 31 40 Z',
  oval: 'M32 38 C32 22 41 16 50 16 C59 16 68 22 68 38 C68 54 60 67 50 67 C40 67 32 54 32 38 Z',
  square: 'M31 34 C31 22 40 18 50 18 C60 18 69 22 69 34 L69 50 C69 60 60 66 50 66 C40 66 31 60 31 50 Z',
} as const

const FACE_POOLS = { she: ['round', 'oval'], he: ['square', 'oval', 'square'], they: ['round', 'oval', 'square'] } as const
const SHIRT_KINDS = ['tee', 'collared', 'plaid', 'hoodie', 'blouse'] as const
const SHIRT_POOLS = {
  she: ['tee', 'blouse', 'collared', 'hoodie'],
  he: ['tee', 'collared', 'plaid', 'hoodie'],
  they: ['tee', 'collared', 'plaid', 'hoodie', 'blouse'],
} as const

const shade = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.max(0, Math.round(v * 0.78))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`
}

const path = (d: string, fill: string, stroke = INK, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke, sw })

function clothing(kind: string, shirt: string, skin: string): SpriteShape[] {
  const dark = shade(shirt)
  switch (kind) {
    case 'collared':
      return [
        path('M42 71 L50 86 L58 71 Z', skin, INK, 2),
        path('M39 69 L50 86 L35 83 Z', '#f4f1ea', INK, 2),
        path('M61 69 L50 86 L65 83 Z', '#f4f1ea', INK, 2),
      ]
    case 'plaid':
      return [
        { kind: 'path', d: 'M20 86 H80 M18 94 H82 M30 80 V100 M44 80 V100 M58 80 V100 M72 80 V100', fill: 'none', stroke: dark, sw: 2 },
        path('M41 71 Q50 80 59 71 Z', skin, INK, 2),
      ]
    case 'hoodie':
      return [
        path('M30 70 Q50 56 70 70 L72 80 Q50 90 28 80 Z', dark),
        path('M45 82 L44 94 M55 82 L56 94', 'none', INK, 2),
      ]
    case 'blouse':
      return [path('M42 71 L50 82 L58 71 Z', skin, INK, 2), path('M50 80 L42 75 L43 85 Z', shirt, INK, 2), path('M50 80 L58 75 L57 85 Z', shirt, INK, 2)]
    default:
      return [path('M41 71 Q50 82 59 71 Z', skin, INK, 2)]
  }
}

export interface PortraitChoices {
  background: string
  skin: string
  hairColor: string
  shirt: string
  hairStyle: string
  facialHair: string
  face: keyof typeof FACES
  shirtKind: (typeof SHIRT_KINDS)[number]
  glasses: boolean
  earrings: boolean
}

/** Everything the portrait varies on: pinned by `suspect.look` where given, otherwise drawn from pools that match the pronoun. */
export function portraitChoices({ name, pronoun, look = {} }: Suspect): PortraitChoices {
  const rng = mulberry32(hashSeed(`portrait:${name}`))
  const background = pick(rng, BACKGROUNDS)
  const skin = pick(rng, SKINS)
  const hairColor = pick(rng, HAIRS)
  const shirt = pick(rng, SHIRTS)
  const hairStyle = pick(rng, STYLE_POOLS[pronoun])
  const facialHair = pick(rng, FACIAL_HAIR_POOLS[pronoun])
  const face = pick(rng, FACE_POOLS[pronoun])
  const shirtKind = pick(rng, SHIRT_POOLS[pronoun])
  const glasses = rng() < 0.2
  const earrings = pronoun !== 'he' && rng() < 0.4
  return {
    background,
    skin: look.skin ?? skin,
    hairColor: look.hairColor ?? hairColor,
    shirt: look.shirt ?? shirt,
    hairStyle: look.hairStyle ?? hairStyle,
    facialHair: look.facialHair ?? facialHair,
    face,
    shirtKind,
    glasses: look.glasses ?? glasses,
    earrings,
  }
}

/** A flat portrait with no facial features, in the style of the reference cards. */
export function portraitFor(suspect: Suspect): SpriteDef {
  const { pronoun } = suspect
  const c = portraitChoices(suspect)
  const { background, skin, hairColor, shirt, shirtKind, glasses, earrings } = c
  const hair = HAIR_STYLES[c.hairStyle](hairColor)
  const neckWidth = pronoun === 'he' ? 18 : pronoun === 'she' ? 12 : 14

  const shapes: SpriteShape[] = [
    { kind: 'rect', x: 0, y: 0, w: 100, h: 100, fill: background },
    path(SHOULDERS[pronoun], shirt),
    ...hair.back,
    { kind: 'rect', x: 50 - neckWidth / 2, y: 56, w: neckWidth, h: 20, fill: skin, stroke: INK, sw: 3 },
    { kind: 'rect', x: 50 - neckWidth / 2 + 1.5, y: 57, w: neckWidth - 3, h: 7, fill: 'rgba(0,0,0,0.12)', stroke: 'none', sw: 0 },
    ...clothing(shirtKind, shirt, skin),
  ]
  if (hair.ears) {
    shapes.push(
      { kind: 'ellipse', cx: 31, cy: 44, rx: 3.5, ry: 5.5, fill: skin, stroke: INK, sw: 2.5 },
      { kind: 'ellipse', cx: 69, cy: 44, rx: 3.5, ry: 5.5, fill: skin, stroke: INK, sw: 2.5 },
    )
    if (earrings) {
      shapes.push(
        { kind: 'ellipse', cx: 31, cy: 51.5, rx: 2, ry: 2, fill: '#f2c14e', stroke: INK, sw: 1 },
        { kind: 'ellipse', cx: 69, cy: 51.5, rx: 2, ry: 2, fill: '#f2c14e', stroke: INK, sw: 1 },
      )
    }
  }
  shapes.push(
    path(FACES[c.face], skin),
    { kind: 'path', d: 'M50 16 C59 16 68 22 68 38 C68 54 60 67 50 67 Z', fill: 'rgba(0,0,0,0.1)', stroke: 'none', sw: 0 },
    ...facialHair(c.facialHair, hairColor),
    ...hair.front,
  )
  if (glasses) {
    shapes.push(
      { kind: 'rect', x: 35, y: 36, w: 13, h: 10, rx: 4, fill: 'rgba(255,255,255,0.3)', stroke: INK, sw: 2 },
      { kind: 'rect', x: 52, y: 36, w: 13, h: 10, rx: 4, fill: 'rgba(255,255,255,0.3)', stroke: INK, sw: 2 },
      { kind: 'path', d: 'M48 40 H52', fill: 'none', stroke: INK, sw: 2 },
    )
  }
  return { shapes }
}
```

Create `src/ui/art/portrait/palette.ts`:

```ts
export const INK = '#1f2430'

export const BACKGROUNDS = [
  '#a85d4a', '#4f8a5b', '#5aa5b0', '#5d6bb0', '#7a4f8f', '#d89a9a',
  '#c9a24a', '#6b7f99', '#8f6f4f', '#6aa088', '#a0829a', '#5f8fbf',
]
export const SKINS = ['#fbdcc4', '#f2c6a0', '#e5b48a', '#d09a6c', '#b57a4e', '#8f5a3a', '#6e4129', '#4f2e1e']
export const HAIRS = [
  '#1c1c24', '#2b1d16', '#4a2f1e', '#6b4423', '#8a5a2b', '#c68a3a',
  '#e0c068', '#c1442e', '#d9742a', '#b8b8c0', '#e8e8ee',
]
export const SHIRTS = [
  '#e0872e', '#9b6bc9', '#3f7fbf', '#d95f7a', '#4fa68a',
  '#c9b04a', '#8a8fa8', '#d8d8e0', '#2f6f6f', '#b5483a',
]
```

After this task, look at the result: open the app and compare the cards. For a systematic check, render every classic suspect, every hair style per pronoun and every facial hair option on a contact sheet (a temporary test that writes an HTML file of `renderToStaticMarkup(<Sprite sprite={portraitFor(...)} />)` works) and review it at card size and at 44px token size. Delete the temporary test afterwards.

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx oxlint && npx vitest run`
Expected: no type errors, no lint warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Draw portraits that follow the pronoun and pin the classic looks"
```

---

### Task 3: Final verification

- [ ] **Step 1: Full verification**

```bash
npx tsc -b && npx oxlint && npx vitest run && npm run build && npx playwright test
```

Expected: every command exits 0. Report the test counts you actually see.

- [ ] **Step 2: Hand back**

Do not merge. Report the branch name, the commit list (`git log --oneline main..suspect-identity`) and the verification output, then use superpowers:finishing-a-development-branch.

---

## Self-Review Notes

- **Spec coverage:** pronoun data and classic assignments (Task 1); pronoun-voiced clues, "were" for they, victim wording (Task 1); portrait pools, features, pinned looks and the distinctness test (Task 2); the visual review step (Task 2). Not done, per the spec: player-chosen pronouns, translated pronouns, hats and other accessories.
- **Types used across tasks:** `Pronoun`, `PortraitLook`, `Suspect` (`src/engine/types.ts`); `portraitChoices`, `portraitFor(suspect)` (`src/ui/art/portrait`); glossary keys `victim` and `alone with the murderer`.
