import { evaluate, isUnaryClue, rulesHold } from './clues'
import type { PartialPlacement } from './plugin'
import { registry } from './registry'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { isOccupiable } from './types'
import type { Clue, Placement, Pos, Puzzle } from './types'

type Assigned = PartialPlacement

const scopeOf = (clue: Clue) => registry.clueType(clue.type).scope

function otherOf(clue: Clue): number | undefined {
  return typeof clue.other === 'number' ? clue.other : undefined
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
          (clue) => clue.suspect !== i || !isUnaryClue(clue) || evaluate(clue, puzzle, probe),
        )
        if (unaryOk) domains[i].push({ r, c })
      })
    }
  }
  return domains
}

function globalPrune(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  return registry.clueType(clue.type).prune?.(clue, puzzle, assigned) ?? true
}

function binaryHolds(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  const other = otherOf(clue)
  if (other === undefined || !assigned[clue.suspect] || !assigned[other]) return true
  return evaluate(clue, puzzle, assigned as Placement)
}

function companyReachable(puzzle: Puzzle, assigned: Assigned, reachable: number[]): boolean {
  return puzzle.clues.every(
    (clue) => registry.clueType(clue.type).feasible?.(clue, puzzle, assigned, reachable) ?? true,
  )
}

export interface SearchOptions {
  rng?: Rng
  nodeBudget?: number
}

/** Returns true when the search finished, false when it hit the node budget. */
function search(puzzle: Puzzle, onSolution: (placement: Placement) => boolean, options: SearchOptions = {}): boolean {
  const { rng, nodeBudget = Infinity } = options
  let nodes = 0
  let exhausted = false
  const built = buildDomains(puzzle)
  const domains = rng ? built.map((d) => shuffle(rng, d)) : built
  if (domains.some((d) => d.length === 0)) return true

  const involving = puzzle.suspects.map((_, i) =>
    puzzle.clues.filter((clue) => scopeOf(clue) === 'binary' && (clue.suspect === i || otherOf(clue) === i)),
  )
  const globals = puzzle.clues.filter((clue) => scopeOf(clue) === 'global')
  const rowUsed = new Array<boolean>(puzzle.size).fill(false)
  const colUsed = new Array<boolean>(puzzle.size).fill(false)
  const assigned: Assigned = new Array(puzzle.size).fill(undefined)
  let stopped = false

  const available = (s: number, pos: Pos): boolean => {
    if (rowUsed[pos.r] || colUsed[pos.c]) return false
    if (involving[s].length === 0) return true
    assigned[s] = pos
    const holds = involving[s].every((clue) => binaryHolds(puzzle, clue, assigned))
    assigned[s] = undefined
    return holds
  }

  const visit = (placedCount: number): void => {
    if (stopped) return
    if (++nodes > nodeBudget) {
      stopped = true
      exhausted = true
      return
    }
    if (placedCount === puzzle.size) {
      const placement = assigned as Placement
      const ok = puzzle.clues.every((clue) => evaluate(clue, puzzle, placement)) && rulesHold(puzzle, placement)
      if (ok && onSolution(placement.map((p) => ({ ...p })))) stopped = true
      return
    }
    let next = -1
    let options: Pos[] = []
    const reachable = new Array<number>(puzzle.rooms.length).fill(0)
    for (let s = 0; s < puzzle.size; s++) {
      if (assigned[s]) continue
      const live = domains[s].filter((pos) => available(s, pos))
      if (live.length === 0) return
      for (const room of new Set(live.map((pos) => puzzle.cells[pos.r][pos.c].room))) reachable[room]++
      if (next === -1 || live.length < options.length) {
        next = s
        options = live
      }
    }
    if (!companyReachable(puzzle, assigned, reachable)) return
    for (const pos of options) {
      assigned[next] = pos
      if (globals.every((clue) => globalPrune(puzzle, clue, assigned))) {
        rowUsed[pos.r] = true
        colUsed[pos.c] = true
        visit(placedCount + 1)
        rowUsed[pos.r] = false
        colUsed[pos.c] = false
      }
      assigned[next] = undefined
      if (stopped) return
    }
  }
  visit(0)
  return !exhausted
}

/** Counts solutions up to `limit`. A search that exhausts its budget reports `limit` (unknown, treat as ambiguous). */
export function countSolutions(puzzle: Puzzle, limit: number, nodeBudget?: number): number {
  let count = 0
  const finished = search(
    puzzle,
    () => {
      count++
      return count >= limit
    },
    { nodeBudget },
  )
  return finished || count >= limit ? count : limit
}

export function solve(puzzle: Puzzle): Placement | null {
  let found: Placement | null = null
  search(puzzle, (placement) => {
    found = placement
    return true
  })
  return found
}

export function findSolutions(puzzle: Puzzle, limit: number, options?: SearchOptions): Placement[] {
  const found: Placement[] = []
  search(
    puzzle,
    (placement) => {
      found.push(placement)
      return found.length >= limit
    },
    options,
  )
  return found
}
