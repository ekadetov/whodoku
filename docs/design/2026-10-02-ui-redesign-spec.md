# Whodoku: UI Redesign Spec

Status: draft for review. Date: 2026-10-02. Extends `2026-10-02-whodoku-spec.md`.
Depends on `2026-10-02-plugin-architecture-spec.md`: tools and themes come from its registries,
so that work lands first.

## 1. Goal

Replace the single-column UI with a layout and interaction model modeled on the reference
Murdoku web player, using original art. Two user-visible changes:

1. **Look and feel:** three-column layout, portrait clue cards, bold outlined board with
   illustrated tiles, a tools panel.
2. **Multi-cell marking:** drag with the X tool or the eraser to mark or clear many cells in
   one stroke.

Engine, generator, daily seed and storage format are unchanged.

## 2. Art and IP

All portraits, object sprites and tile textures are original, drawn as inline SVG. The reference
site is used for layout and interaction ideas only. No files are copied from it.

## 3. Layout

- Wide screens (>= 900px): three columns. Left: suspect cards. Middle: board. Right: tools panel.
- Narrow screens: single column. The cards become a horizontally scrolling strip so the board stays near
  the top, then the board, then the tools as a wrapping bar.
- Removed: `SuspectTray`, the clue list under the board, and `Legend` (room labels on the board
  already name each room).

## 4. Components

| Component | Purpose |
|---|---|
| `SuspectCard` | A portrait on top, a handwritten name plate, and the suspect's rendered clue text (`renderClue`) on a clue card attached below. Click selects the suspect. Pressing and dragging the card onto the board places the suspect on the cell where it is released. Shows a placed badge, a selected ring, a failing highlight after a check, and a struck style. The victim card is marked. Replaces `SuspectTray` and `CluePanel`. |
| `Board` | Tiles with a room texture, object sprites, thick room borders, room labels. Blocked objects are sprites on a normal tile, not a gray overlay. Handles pointer strokes. |
| `ToolsPanel` | X, Eraser, Undo, Hint, Submit, How to play. |
| `art/` | `Sprite` renders theme sprite data (plain shape lists, never raw markup). Portraits are generated from the suspect's name and room textures from the room index. |

Tool behavior:

- **X:** selected tool, highlighted. See section 6.
- **Eraser:** see section 6. Holding the button clears the whole board after a confirm.
- **Undo:** reverts the last action. Disabled when history is empty.
- **Hint:** runs the existing check and shows which suspects contradict their clues.
- **Submit:** disabled until every suspect is placed. Runs the check. When everything fits it
  shows the existing "Who did it?" picker. The win panel is unchanged.
- **How to play:** toggles the existing rules text.

Struck clues keep working: a secondary button on the card toggles the strike.

## 5. State (`reducer.ts`)

- `GameState` gains `tool: 'select' | 'x' | 'eraser'` and `history: DayProgress[]`.
- `select` is the default tool and keeps today's behavior: pick a card, then a cell.
  Choosing X or eraser clears the selected card. Picking a card switches back to `select`.
- New actions: `setTool`, `paint { cells, mode }` with mode `mark | unmark | erase`, `undo`. The
  existing `reset` action is the clear-all action and is undoable.
- Every action that changes placements or marks pushes the previous `DayProgress` onto
  `history` first. History is capped at 100 and kept in memory only. `DayProgress` and the
  localStorage format do not change, so there is no migration. A reload keeps the board but
  starts with an empty undo stack.
- Once solved, `paint`, `undo` and `clearAll` are ignored, like other edits today.

## 6. Drag painting

- The board listens to pointer events (mouse and touch) with `touch-action: none`.
  `pointerdown` starts a stroke, `pointermove` finds the cell under the pointer with
  `elementFromPoint`, `pointerup` ends it. `pointercancel` discards it.
- A stroke is the list of unique cells visited, in order. One `paint` action is dispatched on
  `pointerup`, so a whole stroke is a single undo step. A live preview shows pending marks while
  dragging.
- **X tool:** the first cell decides the mode. Starting on an unmarked cell gives `mark`. Starting
  on a marked cell gives `unmark`. Blocked cells and cells holding a suspect are skipped.
- **Eraser:** mode `erase`. Clears marks and removes any suspect standing on a visited cell.
- A tap is a one-cell stroke, so it needs no special case.
- Dragging a `SuspectCard` uses the same pointer handling: on release over an occupiable cell it
  dispatches `place`, exactly like select-then-click. Released anywhere else, nothing happens.
  Card dragging is for mouse use; on touch screens the cards scroll, so players tap a card and then
  a square.
- Keyboard: cells stay focusable buttons. Enter or Space applies the current tool to that cell.
  Drag is an enhancement, not the only way to play. Blocked cells use `aria-disabled` rather than
  `disabled`, because browsers do not reliably dispatch pointer events on disabled buttons.

## 7. Visual language

Design tokens observed on the reference player's public stylesheet, reimplemented as theme
tokens (see the plugin spec). No reference assets are used.

- **Shadows:** hard offset, no blur. Cards and buttons use `4px 4px` at about 35 to 40% black;
  small elements use `1px` and `3px` variants.
- **Walls:** two weights. Room walls are thick and near-black (`rgba(0,0,0,.9)`). Cell borders are
  thin and light (`rgba(0,0,0,.3)`).
- **Palette:** page `#fff`, panels `#f8f8f8`, borders `#333`, muted text `#666`, name plate
  `#222`. A dark variant is supported through `color-scheme: light dark`. These are CSS variables in
  `src/index.css`; moving them into the theme is future work.
- **Type:** Inter for body text. Caveat (open license, OFL) for names and clue cards. Large white
  room labels with a dark outline, sized to the room.
- **Shape:** 4 to 6px radii. Cards tilt by up to about 1 degree so they look pinned.
- **Tiles:** a texture per room (wood planks, checkerboard, water, cobbles, grass). Props such as
  rugs and tables render as one continuous shape across the cells they cover.
- **Motion** (CSS only, disabled under `prefers-reduced-motion`): a pop when a suspect lands, a
  breathing glow on the selected card, a flash on undo, a nudge on Submit when ready, a flash on
  solve.

## 8. Testing

- **Reducer (TDD, first):** `paint` in each mode, blocked cells skipped, erase removes suspects,
  undo reverts a whole stroke, the 100-entry cap, solved state ignores edits, `setTool` clears
  the selection.
- **Components:** tool switching, `SuspectCard` selection and badges, drag with simulated pointer
  events, Submit disabled until all placed.
- **E2E (Playwright):** drag X across a row, undo it, then solve the puzzle through the new
  layout. Update `solve.spec.ts` selectors (`suspect-*` test ids move to the cards; keep the ids).
- **Visual check:** screenshots at desktop and phone widths.

## 9. Out of scope

- Sound, print, share and settings buttons from the reference.
- A timer display (can be added later; `startedAt` is already stored).
- Persisting undo history.
- Authoring themes beyond the default one. The theme system itself is in the plugin spec.
- Theme-level UI tokens (see section 7).
