import { evaluate } from './clues'
import { registry } from './registry'
import type { Clue, ObjectKind, Placement, Puzzle } from './types'

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
  allowed: ReadonlySet<string>,
): Clue[] {
  return registry
    .clueTypes()
    .filter((def) => allowed.has(def.id))
    .flatMap((def) => def.candidates?.(puzzle, placement, suspect) ?? [])
    .filter((clue) => evaluate(clue, puzzle, placement))
}
