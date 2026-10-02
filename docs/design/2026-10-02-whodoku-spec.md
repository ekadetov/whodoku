# Whodoku: MVP Spec

Status: draft for review. Date: 2026-10-02.

## 1. Goal

A free, browser-based daily murder-mystery logic puzzle. One deterministic puzzle per day, the
same for every player, with no backend. Installable as a PWA, deployed to GitHub Pages.

Success criteria for the MVP:

- Every generated puzzle has exactly one solution (verified by the solver in tests).
- The same date always yields the same puzzle on every device.
- A player can solve today's puzzle, close the tab, return, and see progress and streak intact.
- The app installs as a PWA and works offline after the first load.
- CI (typecheck, tests, build) passes and every push to `main` deploys to GitHub Pages.

Non-goals for the MVP: accounts, leaderboards, payments, archive of past puzzles, localization,
native app wrappers, user-submitted puzzles.

## 2. Naming and legal

- Product name: **Whodoku**. Repo: public `ekadetov/whodoku`.
- No trademark search has been done. Do one before buying a domain or launching publicly.
- The puzzle genre ("Murdoku", by Manuel Garand) is a commercial product. Game rules are not
  copyrightable, but its name, art, themes and published puzzles are. Whodoku must use its own
  name, its own art, its own room and character names, and procedurally generated puzzles. The
  example PDFs are used only to understand the rules and are not committed to the repo.

## 3. Puzzle rules (as implemented)

Derived from the example puzzles (Courtroom, Zoo, Botanical Garden, Preppers, Car Repair) and
the public glossary.

### 3.1 Board

- Square N x N grid. The number of suspects equals N (Courtroom: 9 suspects; Zoo: 16).
- The grid is partitioned into **rooms**, each a connected set of cells with a name.
- Each cell is one of:
  - **floor**: occupiable.
  - **occupiable object**: chair, rug, water. A suspect may stand on it.
  - **blocking object**: table, shelf, plant, rock, tree, TV. Nobody may stand on it.
- Objects belong to a cell and may be relevant to clues ("sitting on a chair", "on a rug").

### 3.2 Placement rule

- Each suspect is placed on exactly one occupiable cell.
- **One suspect per row and per column** (a permutation, like N-queens without the diagonal
  rule).

### 3.3 Victim and killer

- One suspect is the **victim**. The victim's clue always reads "was alone with the killer".
- The **killer** is the one other suspect in the victim's room. The solution has exactly two
  suspects in the victim's room.
- The player's task: place everyone, then name the killer.

### 3.4 "Alone" and "beside"

- Two people in a room are "alone together". Three or more are not.
- "Beside an object" means an orthogonally adjacent cell (up, down, left, right) in the same room
  holds that object. Diagonals do not count, and standing on the object is not "beside" it.
- Because of the one-per-row-and-column rule, two suspects can never be orthogonally adjacent, so
  there is no "beside a suspect" clue. Relative suspect clues use row and column offsets instead.

### 3.5 Puzzle-specific global rules (optional per puzzle)

The Zoo adds rules such as "only handlers may be in enclosures; every enclosure has at least one
handler". The MVP engine supports one such rule family, `roomRoleConstraint`, deferred to
post-MVP unless the generator needs it. MVP puzzles use only the rules in 3.1 to 3.4.

## 4. Clue vocabulary

Each suspect has one clue. A clue is a predicate over the full placement. The engine ships these
clue types (names illustrative, final names set in the plan):

| Type | Example text | Predicate |
|---|---|---|
| inRoom | "was in the Library" | suspect's room == R |
| notInRoom | "was not in the Kitchen" | room != R |
| onObject | "was sitting on a chair" | cell has object of kind K |
| notOnObject | "was not on a rug" | negation |
| besideObject | "was beside a plant" | any orthogonal neighbor in same room has kind K |
| notBesideObject | "was not beside water" | negation |
| inColumn / inRow | "was in column 2", "in the top row" | index equality |
| northOf | "was one row north of Ivan" | suspect row = other row - delta |
| westOf | "was two columns west of Ivan" | suspect column = other column - delta |
| aloneInRoom | "was alone" | room has exactly 1 suspect |
| withCount | "was with exactly one other person" | room has exactly 2 suspects |
| onlyOnObject | "was the only person on a rug" | the only suspect on any cell of kind K |
| sameRoomAs | "was in the same room as Eliza" | rooms equal |

The victim's clue is fixed. All text is English in the MVP, built from templates so strings can
be externalized later.

## 5. Architecture

Client-side only. Pure TypeScript engine, thin React UI.

```
src/
  engine/              pure TS, no React, no DOM, fully unit tested
    types.ts           Grid, Room, Cell, ObjectKind, Suspect, Clue, Puzzle, Placement
    rng.ts             seeded PRNG (mulberry32) and string-to-seed hash
    clues.ts           clue constructors, evaluate(clue, placement), render(clue) text
    solver.ts          countSolutions(puzzle, limit) via backtracking with row/column pruning
    layout.ts          procedural room partition and object scattering
    generator.ts       generate(seed, difficulty) -> Puzzle
    daily.ts           dateKey(date) -> seed -> difficulty -> Puzzle
  ui/                  React components
    Board, CluePanel, SuspectTray, Toolbar, WinDialog, Stats, App
  state/               reducer, localStorage persistence (versioned), streak logic
  pwa/                 manifest and service worker config
```

Boundaries:

- `engine/` exports `generate`, `countSolutions`, `isSolved`, `dailyPuzzle`. It has no imports
  from `ui/` or `state/`.
- `state/` depends on `engine/` types only.
- `ui/` depends on `engine/` and `state/`.

### 5.1 Generation algorithm

1. Seed the RNG from the date key (`YYYY-MM-DD`, UTC) plus a constant salt.
2. Pick N from the difficulty tier. Generate a room partition (grow N or more connected regions
   by randomized flood fill) and scatter objects.
3. Choose a random valid placement of N suspects (one per row and column on occupiable cells).
4. Pick the victim such that their room contains exactly one other suspect (the killer). Retry
   the placement if none qualifies.
5. Assign each suspect a candidate clue true under the placement.
6. Run the solver. While more than one solution exists, strengthen clues (swap a weak clue for a
   more specific true one). Then try removing or weakening clues to reach the target difficulty
   while the solution stays unique.
7. Reject and restart with a derived sub-seed if uniqueness cannot be reached within a step
   budget. Generation must finish in under 250 ms for the largest tier in a modern browser.

### 5.2 Difficulty tiers

| Tier | N | Clue mix |
|---|---|---|
| Easy | 6 | direct clues (room, object) dominate |
| Medium | 8 | adds row/column, alone, sameRoomAs |
| Hard | 10 | adds northOf, westOf, onlyOnObject, negatives |

Daily difficulty follows the weekday: Monday Easy through Sunday Hard on a fixed rotation
(Mon, Tue Easy; Wed, Thu Medium; Fri, Sat, Sun Hard). Tier sizes and the rotation are tunable
constants.

### 5.3 Interaction model

- Tap a suspect, then tap a cell to place. Tap a placed suspect to remove or move.
- Players can mark cells as "ruled out" (X) for note-taking. Marks have no effect on checking.
- Row and column conflicts and placement on blocking cells are highlighted immediately.
- A "Check" action reports whether all suspects are placed legally, and a final "Accuse" step
  selects the killer. Correct accusation with a valid placement solves the puzzle.
- Clue cards can be struck through by the player (visual aid only).

### 5.4 Persistence

localStorage, single versioned key:

```
{ v: 1,
  today: { dateKey, placements, marks, solved, startedAt, solvedAt },
  history: { "<dateKey>": { solved, seconds } },
  streak: { current, best, lastSolvedDateKey } }
```

A missing day resets `current` to 0 on the next solve. Unknown versions are discarded rather than
migrated in the MVP.

### 5.5 Date handling

The daily key uses UTC so all players change puzzle at the same instant. This is documented in
the UI. A local-time rollover is a possible later change.

## 6. PWA

- `vite-plugin-pwa` with a web manifest (name, icons, standalone display, theme color) and a
  precaching service worker for the built assets.
- The puzzle is generated on the client, so offline play works after the first load.
- Icons: original placeholder artwork, replaceable later.

## 7. Tooling and delivery

- Vite, React, TypeScript (strict), Vitest, ESLint and Prettier.
- GitHub Actions workflow `ci.yml`: install, typecheck, lint, test, build on every push and PR.
- Workflow `deploy.yml`: on push to `main`, build with Vite `base: '/whodoku/'` and publish
  `dist/` to GitHub Pages.
- Repo setup: public repo `ekadetov/whodoku`, `main` as default branch, README with rules and
  development instructions, MIT license.

## 8. Testing strategy

- **Solver**: hand-built small puzzles with known solution counts (zero, one, many).
- **Clues**: each clue type has table-driven tests for true and false cases and for text
  rendering.
- **Generator properties**, run over a fixed set of seeds per tier (for example 200 each):
  - exactly one solution;
  - one suspect per row and column, none on blocking cells;
  - the victim's room holds exactly two suspects;
  - the same seed produces a byte-identical puzzle;
  - generation completes within the time budget.
- **Daily**: a fixed date maps to a fixed puzzle (snapshot), and UTC boundaries are handled.
- **State**: reducer and streak logic unit tests, including missed days and corrupt storage.
- **UI**: a few component tests for placement and conflict highlighting, plus one end-to-end
  smoke test (Playwright) that solves a seeded puzzle through the UI.

## 9. Error handling

- Generator failure on a seed falls back to a derived sub-seed, deterministically, so every
  player still gets the same puzzle.
- Corrupt or unknown-version localStorage is cleared and the app starts fresh.
- If localStorage is unavailable (private mode), the game works without persistence and shows a
  small notice.

## 10. Delivery order

1. Repo setup: create the public GitHub repo, push, add CI skeleton and Pages deploy.
2. Engine, test-first: types, rng, clues, solver, layout, generator, daily.
3. State layer and persistence.
4. Playable UI with the daily puzzle.
5. PWA manifest and service worker.
6. Playwright smoke test, polish, README.

## 11. Open decisions (defaults chosen, change if you disagree)

- Tier sizes 6/8/10 and the weekday rotation (examples go up to 16 suspects, which is likely too
  big for a phone UI in an MVP).
- English only.
- Procedural generic themes, not hand-authored themed scenes like the Zoo or Courtroom.
- UTC day boundary.
- MIT license.
