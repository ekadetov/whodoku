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
