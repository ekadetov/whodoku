import { evaluate } from './clues'
import type { Clue, ClueType, ObjectKind, Placement, Puzzle } from './types'

export function objectKindsIn(puzzle: Puzzle): ObjectKind[] {
  const kinds = new Set<ObjectKind>()
  for (const row of puzzle.cells) for (const cell of row) if (cell.object) kinds.add(cell.object)
  return [...kinds]
}

/** Every clue about `suspect` that is true under `placement` and whose type is allowed. */
export function candidateClues(
  puzzle: Puzzle,
  placement: Placement,
  suspect: number,
  allowed: ReadonlySet<ClueType>,
): Clue[] {
  const found: Clue[] = []
  const add = (clue: Clue) => {
    if (allowed.has(clue.type) && evaluate(clue, puzzle, placement)) found.push(clue)
  }
  const me = placement[suspect]

  puzzle.rooms.forEach((_, room) => {
    add({ type: 'inRoom', suspect, room })
    add({ type: 'notInRoom', suspect, room })
  })
  for (const kind of objectKindsIn(puzzle)) {
    add({ type: 'onObject', suspect, kind })
    add({ type: 'notOnObject', suspect, kind })
    add({ type: 'besideObject', suspect, kind })
    add({ type: 'notBesideObject', suspect, kind })
    add({ type: 'onlyOnObject', suspect, kind })
  }
  add({ type: 'inColumn', suspect, col: me.c })
  add({ type: 'inRow', suspect, row: me.r })
  add({ type: 'aloneInRoom', suspect })
  add({ type: 'withOneOther', suspect })

  placement.forEach((other, index) => {
    if (index === suspect) return
    add({ type: 'sameRoomAs', suspect, other: index })
    if (other.r > me.r) add({ type: 'northOf', suspect, other: index, delta: other.r - me.r })
    if (other.c > me.c) add({ type: 'westOf', suspect, other: index, delta: other.c - me.c })
  })
  return found
}
