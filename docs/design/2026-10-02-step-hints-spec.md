# Whodoku: Step Hints Spec

Status: approved direction, to be planned last. Date: 2026-10-02. Behavior seen in the reference player by pressing
its Hint button on the "Car Repair" puzzle; no text or assets are copied.

## 1. What the reference does

- Hint opens a panel over the bottom of the suspect cards titled "Hint" with a counter ("Hint
  1/5"), previous and next arrows, a close button, and a link to a solution video.
- Each hint is one deduction, written as a sentence that cites the clues: "Because D is alone in the
  Waiting Area, C can only be sitting in the only chair at the Reception, in R1 C2."
  - Suspects appear as their initial badges, the same badges used on the board.
  - Squares are named by row and column ("R1 C2").
- The board shows the answer square of the current hint with a blue ring around it.
- There are five hints for a 6x6 puzzle, leading from the first forced placement to the full
  solution; the hints belong to the puzzle, not to what the player has already placed (the hint
  panel ignored the wrong arrangement on the board).
- The Hint button gets a glow while the panel is open.

## 2. What it would take for us

Our puzzles are generated, so there is no hand-written solution video or hand-written hint list.
Hints would have to be derived from the clues:

1. A deduction engine that, starting from the clues alone, repeatedly finds a suspect whose square
   is forced and records why (which clue, which eliminated squares).
2. A sentence writer that turns each recorded reason into text, reusing the clue pieces so suspects
   and squares link to the board.
3. A panel and a board ring, which are plain UI.

Parts 1 and 2 are the real work. The solver we have finds the solution but does not explain it, and
the generator guarantees uniqueness, not that a human-style chain of simple deductions exists, so
some puzzles may need a hint that says "try this suspect" without a full reason.

## 3. Proposal

- Keep the current Hint button behavior (the "does everything fit" check) until this is built.
- Build step hints as a separate feature after notes and placement land, starting with the two
  easiest reasons ("only one square left in this row, column or room" and "this clue allows only one
  square"), and falling back to "place X here" for puzzles those cannot explain.

## 4. Decisions

Decided by the owner ("pick the best approach", following "everything as in the original"):

- Hints are a fixed walkthrough of the puzzle, from the first forced placement to the full
  solution, independent of the player's board, with previous and next arrows and a counter.
- When no simple reason exists for a step, the hint says to place the suspect there without a
  reason.
- The existing Hint button behavior (checking whether the board fits the clues) stays until step
  hints exist; it then moves to a separate control so the Hint button matches the reference.
