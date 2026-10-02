import type { RuleDef } from '../../engine/plugin'
import type { Placement, Puzzle } from '../../engine/types'

export function killerOf(puzzle: Puzzle, placement: Placement): number | null {
  const roomOf = (suspect: number) => puzzle.cells[placement[suspect].r][placement[suspect].c].room
  const room = roomOf(puzzle.victim)
  const others = placement.map((_, i) => i).filter((i) => i !== puzzle.victim && roomOf(i) === room)
  return others.length === 1 ? others[0] : null
}

export const victimRule: RuleDef = {
  id: 'victim-killer',
  check: (puzzle, placement) => killerOf(puzzle, placement) !== null,
  answer: killerOf,
}
