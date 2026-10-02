# Whodoku: Notes and Placement Spec

Status: approved by the owner. Date: 2026-10-02. Amends `2026-10-02-ui-redesign-spec.md` (sections 4 to 6)
and `2026-10-02-clue-hints-spec.md`. Behavior observed from screenshots of the reference player;
no reference assets or code are used.

## 1. Goal

Separate guessing from committing. Clicking a square with a suspect selected leaves a small note
("this suspect might be here"); only holding places the suspect for real. Placing a suspect rules
out the rest of its row and column automatically. This replaces the current rule where a click
places a suspect.

## 2. Behavior

### 2.1 Notes (click)

- Select a card, then click an allowed square: the suspect's initial is left in that square as a
  note. Clicking the same square again with the same card removes the note.
- When a card is selected for the first time, a dismissible toast explains the two gestures: "Tap
  the grid to write a note, or press and hold to place this character."
- While a card is selected, squares that cannot be used (blocking objects) are tinted red.
- Several suspects can leave notes in the same square, and one suspect can leave notes in many
  squares. Notes never count toward the solution or the checks; they are for the player.
- A note is a bold initial in a dark-outlined circle in the suspect's own color (initials can
  repeat, colors do not). Several notes in a square sit in a small grid.
- "Allowed" means an occupiable square that is not crossed out. A crossed-out square (a manual X or
  an automatic one, section 2.3) accepts no notes and no placement until the cross is erased.

### 2.2 Placing (hold)

- With a card selected, pressing and holding on an allowed square (600 ms) places the suspect
  there. About 160 ms into the hold a circle starts to draw itself closed around the square like a
  progress indicator and finishes at 600 ms; releasing before it closes cancels the hold, and a
  short press is just the click that leaves a note. The ring is a 100px SVG centred on the square
  (the square is 60px, so it overhangs): a thick black circle with a thinner arc inside it in the
  suspect's portrait colour, starting at 12 o'clock and growing clockwise. The portrait token appears as a bare outlined bust
  (no circle), with a small badge showing the suspect's initial in the square's top-left corner.
- A placed suspect's card is greyed out (portrait, name and clue faded). Its clue stays readable,
  but hovering it no longer lights the board. A greyed card can still be selected: holding on
  another square then moves that suspect there, and the crosses from the old position stay as
  ordinary crosses (decided: everything as in the reference).
- Placing deselects the card.
- Dragging a card onto a square places the suspect as before, and stays as a desktop shortcut; it
  behaves exactly like a hold.
- There is no way to pick a placed suspect back up except Undo (and the eraser tool, which still
  removes a token like any other mark).
- Placing a suspect removes that suspect's notes everywhere, and any other suspect's notes in the
  square it now occupies.

### 2.3 Automatic crosses

- Placing a suspect crosses out every other allowed, unoccupied square in its row and column. They
  are ordinary crosses: they look like manual X marks and the eraser clears them.
- Blocked squares (tables, shelves, ...) get no cross, and notes already sitting in the squares that
  get crossed out are removed.
- Because those squares are crossed out, two suspects can no longer be placed in one row or column
  by accident. The red conflict outline remains for the case where a cross was erased first.

### 2.4 Undo

One Undo step reverts a note, or a placement together with its automatic crosses and the notes it
removed. Notes and crosses are part of the saved progress, so a reload keeps them.

### 2.5 Interaction with the other tools

- The X and eraser stroke tools are unchanged; the eraser also clears notes in the squares it
  passes over.
- With no card selected, clicking an empty square still toggles a cross, as today.
- Hover highlights and tooltips (clue hints spec) work the same. A square's tooltip does not list
  its notes.

## 3. Data

- `DayProgress.notes: Record<string, number[]>` maps a square key (`"r,c"`) to the suspects with a
  note there. It is optional in saved data and defaults to empty, so no storage version bump.
- Reducer: `toggleNote { pos, suspect }`. `place` gains the list of squares to cross out, computed
  by the game from the puzzle (the reducer does not know which squares are blocked). It is one
  history entry.
- A suspect's initial is `name[0]`; the color is the existing per-suspect color.

## 4. UI

- Board: renders note circles and the token badge; a pointer-down with a card selected starts the
  hold timer and a circular progress ring on that square, drawn as an SVG circle whose stroke closes
  over the hold time (a CSS animation; under reduced motion the hold still works but shows no ring).
  Releasing early is a click (a note), and the click that follows a completed hold is swallowed.
- Suspect cards: a placed card gets the disabled look and ignores selection.
- Touch: press-and-hold works on touch screens, and this replaces the need to drag cards on phones.

## 5. Testing

- Reducer: toggling notes on and off; several suspects in one square; placing removes the suspect's
  notes and the square's notes, adds the line crosses, and is one undo step; notes persist through
  save and load; the eraser clears notes.
- Board: a click leaves a note; a hold places; an early release does not; crossed-out squares
  accept neither; the ring appears during the hold.
- Cards: a placed card is disabled but still highlights on hover.
- Playwright: select a card, click two squares, see two initials; hold on one, see the token, the
  crosses along its row and column, and a greyed card; Undo restores everything.

## 6. Out of scope

- Moving a placed suspect without Undo.
- Notes listed in the square tooltip.
- A different hold time per device.

## 7. Verified against the reference player

Checked by driving the original in Orca's browser, with screenshots:

- Clicking a square with a card selected leaves the initial at the square's top-left; clicking the
  same square again removes it (toggle). Notes from different suspects share a square.
- A crossed-out square accepts no note: clicking it with a card selected changes nothing.
- A hold places the suspect: bare outlined bust plus a letter badge, card greyed and deselected,
  and every other open square in the row and column is crossed out, including squares with rugs and
  chairs but not shelves or tables; notes in those squares disappear.
- Undo reverts one change at a time, including removing a note (it restored a note I had removed).
- Hovering a greyed card does not light the board. While another card is selected, a placed
  suspect named by its clue gets a blue badge on the token ("south of Cameron" turned Cameron's
  badge blue).
- The red tint on blocking squares appears while a card is selected; I did not establish whether it
  is permanent or a brief flash after each click.
- A selected card's name plate turns blue.

Also observed by solving the whole puzzle in the reference (a 6x6 "very easy" case):

- The hold fires at 600 ms and the ring appears about 160 ms after pressing, measured by
  timestamping DOM changes. The press adds the note instantly; the placement removes it.
- After a placement the automatic crosses pop in one after another, 80 to 160 ms apart, not all at
  once.
- Game progress (tokens, crosses, notes) survives a page reload; the undo history does not.
- Holding the eraser tool clears every cross, note and token at once with no confirmation, and
  empties the undo history. The eraser stays the active tool afterwards.
- When all suspects are placed the Submit button turns yellow and loses its "(place all first)"
  caption. There is no "who did it?" step: Submit checks the arrangement directly. On success,
  Hint and Submit disable, the board dims, a green ring appears around every token, a tilted "CASE
  SOLVED" stamp shows, and a Result dialog follows: "You've found the murderer! Cameron (C) killed
  Vinita (V)!" with Next puzzle, Back to puzzles and Share. The timer stops.
- With no card selected, clicking an empty square does nothing (no cross appears); crosses come
  from the X tool and from placements.
- A wrong Submit ends the game just like a right one: the board dims, a red ring appears on every
  wrongly placed token (a right one gets green), and the Result dialog says "You did not find
  everyone's position! 0 of 6 correct. The murderer escaped!" with Play again, Share and Back to
  puzzles. It counts how many suspects are in their solution square.
- The puzzle list shows each puzzle as a card with its title, difficulty and size; a solved one
  shows a miniature of the finished board, "CASE SOLVED" and the time. A new puzzle's card has to be
  clicked once to reveal it, and again to open it.
- A second puzzle (a garage) has cars that span two squares and are standable ("in a car"), oil
  slicks you can stand on, and an L-shaped table: multi-square props are normal in the reference.

## 8. Decisions

Decided by the owner: everything as in the reference.

- Our "Who did it?" step is removed. Submit checks the arrangement directly; a correct one shows
  the CASE SOLVED stamp, green rings and the result sentence naming the killer (from the victim
  rule); a wrong one shows red rings on the wrong tokens and the count of correct positions.
  This changes the current check flow: the Hint button keeps the existing "does it fit" check.
- A greyed card can be selected again to move its suspect (section 2.2).
- Clicking an empty square with no card selected does nothing.
- Submit's caption "(place all first)" shows until everyone is placed; the button then turns yellow.
- Not yet checked in the reference: what the Hint button does.
