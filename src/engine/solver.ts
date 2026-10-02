import { evaluate, killerOf } from './clues'
import { isOccupiable } from './types'
import type { Clue, Placement, Pos, Puzzle } from './types'

type Assigned = (Pos | undefined)[]

const GLOBAL_TYPES = new Set<Clue['type']>(['aloneInRoom', 'withOneOther', 'onlyOnObject'])
const BINARY_TYPES = new Set<Clue['type']>(['northOf', 'westOf', 'sameRoomAs'])

function otherOf(clue: Clue): number | undefined {
  return 'other' in clue ? clue.other : undefined
}

function buildDomains(puzzle: Puzzle): Pos[][] {
  const domains: Pos[][] = puzzle.suspects.map(() => [])
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      if (!isOccupiable(puzzle.cells[r][c])) continue
      puzzle.suspects.forEach((_, i) => {
        const probe: Placement = []
        probe[i] = { r, c }
        const unaryOk = puzzle.clues.every(
          (clue) =>
            clue.suspect !== i || GLOBAL_TYPES.has(clue.type) || BINARY_TYPES.has(clue.type) || evaluate(clue, puzzle, probe),
        )
        if (unaryOk) domains[i].push({ r, c })
      })
    }
  }
  return domains
}

function globalPrune(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  const pos = assigned[clue.suspect]
  if (!pos) return true
  const room = puzzle.cells[pos.r][pos.c].room
  const placed = assigned.filter((p): p is Pos => p !== undefined)
  const inRoom = placed.filter((p) => puzzle.cells[p.r][p.c].room === room).length
  switch (clue.type) {
    case 'aloneInRoom':
      return inRoom <= 1
    case 'withOneOther':
      return inRoom <= 2
    case 'onlyOnObject':
      return placed.filter((p) => puzzle.cells[p.r][p.c].object === clue.kind).length <= 1
    default:
      return true
  }
}

function binaryHolds(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  const other = otherOf(clue)
  if (other === undefined || !assigned[clue.suspect] || !assigned[other]) return true
  return evaluate(clue, puzzle, assigned as Placement)
}

function search(puzzle: Puzzle, onSolution: (placement: Placement) => boolean): void {
  const domains = buildDomains(puzzle)
  if (domains.some((d) => d.length === 0)) return

  const order = domains.map((_, i) => i).sort((a, b) => domains[a].length - domains[b].length)
  const involving = puzzle.suspects.map((_, i) =>
    puzzle.clues.filter((clue) => BINARY_TYPES.has(clue.type) && (clue.suspect === i || otherOf(clue) === i)),
  )
  const globals = puzzle.clues.filter((clue) => GLOBAL_TYPES.has(clue.type))
  const rowUsed = new Array<boolean>(puzzle.size).fill(false)
  const colUsed = new Array<boolean>(puzzle.size).fill(false)
  const assigned: Assigned = new Array(puzzle.size).fill(undefined)
  let stopped = false

  const visit = (depth: number): void => {
    if (stopped) return
    if (depth === order.length) {
      const placement = assigned as Placement
      const ok = puzzle.clues.every((clue) => evaluate(clue, puzzle, placement)) && killerOf(puzzle, placement) !== null
      if (ok && onSolution(placement.map((p) => ({ ...p })))) stopped = true
      return
    }
    const s = order[depth]
    for (const pos of domains[s]) {
      if (rowUsed[pos.r] || colUsed[pos.c]) continue
      assigned[s] = pos
      const consistent =
        involving[s].every((clue) => binaryHolds(puzzle, clue, assigned)) &&
        globals.every((clue) => globalPrune(puzzle, clue, assigned))
      if (consistent) {
        rowUsed[pos.r] = true
        colUsed[pos.c] = true
        visit(depth + 1)
        rowUsed[pos.r] = false
        colUsed[pos.c] = false
      }
      assigned[s] = undefined
      if (stopped) return
    }
  }
  visit(0)
}

export function countSolutions(puzzle: Puzzle, limit: number): number {
  let count = 0
  search(puzzle, () => {
    count++
    return count >= limit
  })
  return count
}

export function solve(puzzle: Puzzle): Placement | null {
  let found: Placement | null = null
  search(puzzle, (placement) => {
    found = placement
    return true
  })
  return found
}
