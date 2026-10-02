import { registry } from './registry'
import { isOccupiable } from './types'
import type { Clue, Placement, Puzzle } from './types'

export const isUnaryClue = (clue: Clue): boolean => registry.clueType(clue.type).scope === 'unary'

export function evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean {
  return registry.clueType(clue.type).evaluate(clue, puzzle, placement)
}

export function renderClue(clue: Clue, puzzle: Puzzle): string {
  return registry.clueType(clue.type).render(clue, puzzle, registry.theme(puzzle.themeId))
}

export function isLegalPlacement(puzzle: Puzzle, placement: Placement): boolean {
  if (placement.length !== puzzle.size) return false
  const rows = new Set<number>()
  const cols = new Set<number>()
  for (const { r, c } of placement) {
    const inBounds = r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size
    if (!inBounds || !isOccupiable(puzzle.cells[r][c])) return false
    rows.add(r)
    cols.add(c)
  }
  return rows.size === puzzle.size && cols.size === puzzle.size
}

export function rulesHold(puzzle: Puzzle, placement: Placement): boolean {
  return registry.rules().every((rule) => rule.check(puzzle, placement))
}

export function answerOf(puzzle: Puzzle, placement: Placement): number | null {
  for (const rule of registry.rules()) {
    const answer = rule.answer?.(puzzle, placement) ?? null
    if (answer !== null) return answer
  }
  return null
}

export function isSolved(puzzle: Puzzle, placement: Placement): boolean {
  return (
    isLegalPlacement(puzzle, placement) &&
    rulesHold(puzzle, placement) &&
    puzzle.clues.every((clue) => evaluate(clue, puzzle, placement))
  )
}
