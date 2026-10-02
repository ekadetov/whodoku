# Whodoku: Clue Hints Spec

Status: approved by the owner. Date: 2026-10-02. Extends `2026-10-02-ui-redesign-spec.md` and
`2026-10-02-plugin-architecture-spec.md`.

## 1. Goal

Make clues explorable. Pointing at a suspect card, or keeping one selected, lights up the part of
the board its clue talks about. Pointing at a board cell tells you what it is and, when a card is
selected, repeats that card's clue. Keywords in a clue explain themselves. This follows the
behavior of the reference player, observed from screenshots; no reference assets or code are used.

## 2. Behavior

### 2.1 Which card is "active"

- Pointer anywhere over a card (portrait, name plate or clue card) makes it active while the pointer
  is there. Keyboard focus anywhere inside a card does the same.
- A selected card stays active until it is deselected. This is also how touch screens get the
  feature, since they have no hover.
- Hover wins over selection: while the pointer is over another card, that card's hints show; they
  revert to the selected card's hints when the pointer leaves.
- The selected card is drawn with a blue frame and a blue name plate. The name plate is always
  visible, so there is no separate name tooltip on the portrait.

### 2.2 What an active card highlights

Hints come from the pieces of the clue text (section 3), so every clue type, including plugin
clue types, highlights its own referents with no extra code.

| Clue piece | Highlighted |
|---|---|
| object (`onObject`, `notOnObject`, `onlyOnObject`, `besideObject`, `notBesideObject`) | every cell holding that object, and only those cells (a "beside a plant" clue lights the plants, not their neighbors) |
| room (`inRoom`, `notInRoom`) | the room's cells, with its boundary outlined |
| column or row (`inColumn`, `inRow`) | that column or row |
| person (`northOf`, `westOf`, `sameRoomAs`) | the other suspect's card, and their token on the board if placed; any objects, rooms, rows or columns the same clue names are highlighted too |
| none (`aloneInRoom`, `withOneOther`) | nothing |

Target cells are filled blue with a blue outline. A highlighted suspect gets a blue ring on the
card and on the token.

### 2.3 Hovering a board cell

- The cell gets a white frame, or a red frame when it cannot be occupied (a blocking object such
  as a table or shelf). Further visual rules will be added as the feature is built.
- A tooltip names it: the object's label if it has one ("Chair", "Shelf"), otherwise the room's
  name.
- The cell's room gets a blue boundary outline.
- When a card is selected, the tooltip also shows that suspect's clue text, as a reminder while
  placing.
- Touch screens have no hover, so none of this applies there; tapping a cell with a card selected
  places the suspect as today.

### 2.4 Keyword tooltips

Relation phrases in a clue ("beside", "north of", "in the same room as") are bold, and hovering
one shows a one-line explanation from the theme's glossary. Object, room and person words are bold
too, without a tooltip. Tooltips are desktop only: the clue card is itself a button (tap to cross
the clue out), so keywords cannot be separate tap targets.

### 2.5 Accessibility and motion

- Highlights use fill plus an outline, never color alone.
- No new animation beyond a short fade; the existing reduced-motion rule disables it.
- Cell labels already include the object and occupant for screen readers.

## 3. Data

- `ClueTypeDef.render(clue, puzzle, theme): string` becomes
  `parts(clue, puzzle, theme): ClueText[]`. `renderClue` joins the parts, so every current text
  expectation is unchanged.
- `ClueText` is one of:
  - `{ kind: 'text', text }`
  - `{ kind: 'relation', text, term }` where `term` keys the glossary
  - `{ kind: 'object', text, object }`
  - `{ kind: 'room', text, room }`
  - `{ kind: 'person', text, suspect }`
  - `{ kind: 'column', text, col }` and `{ kind: 'row', text, row }`
- `ThemeObject` gains `label` (display name, "Rug").
- `ThemeDef` gains `glossary: Record<string, string>` (relation term to explanation). The theme
  validator requires every term used by a registered clue type to have an entry in each theme.
- A pure function `hintTargets(parts, puzzle)` returns `{ cells, rooms, suspects }` for the UI, so
  highlight logic is tested without rendering.

## 4. UI

- `Game` owns `hovered: number | null`; `active = hovered ?? selected`.
- `SuspectPanel` renders each clue from its parts, reports pointer enter/leave and focus/blur for a
  whole card, and marks the active card and highlighted suspects.
- `Board` receives the highlight (`cells`, `rooms`, `suspects`), tracks the hovered cell, and draws
  the frame, tooltip and room outline. Room outlines are drawn per cell side where a neighbor is
  outside the room, using the same adjacency test as the walls.
- Board tokens keep portraits (the reference shows initials); that difference stays.

## 5. Testing

- Parts for all 14 clue types, joined, equal today's text; each part kind has a case.
- `hintTargets` for each part kind on the tiny fixture, including "beside a plant" lighting only
  the plant cells and a room clue returning the room.
- Component tests: hovering any part of a card highlights; keyboard focus does too; selection
  persists after the pointer leaves; hover overrides selection; the selected frame appears; cell
  hover shows the tooltip, the room outline, a white frame, and a red frame for a blocked cell; the
  selected clue text appears in the cell tooltip; a keyword tooltip shows its glossary entry.
- Theme validator: a missing glossary term is rejected.
- One Playwright test: select a card, hover a cell, see the tooltip with the clue text.

## 6. Out of scope

- Highlighting the killer for the victim's "alone with the killer" clue.
- Glossary tooltips on touch screens.
- Dimming everything outside the highlighted area.
- Translations of the glossary.

## 7. Assumptions to confirm

- A cell with no object shows its room's name in the tooltip (the screenshots only show objects).
- Confirmed by the owner: a clue naming another person lights that person's card together with
  any areas or objects it also names.
