import { evaluate, isUnaryClue, killerOf } from './clues'
import { shuffle } from './rng'
import type { Rng } from './rng'
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
          (clue) => clue.suspect !== i || !isUnaryClue(clue) || evaluate(clue, puzzle, probe),
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

function companyReachable(puzzle: Puzzle, assigned: Assigned, reachable: number[]): boolean {
  return puzzle.clues.every((clue) => {
    if (clue.type !== 'withOneOther') return true
    const pos = assigned[clue.suspect]
    if (!pos) return true
    const room = puzzle.cells[pos.r][pos.c].room
    const inRoom = assigned.filter((p) => p && puzzle.cells[p.r][p.c].room === room).length
    return inRoom >= 2 || reachable[room] >= 2 - inRoom
  })
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
    puzzle.clues.filter((clue) => BINARY_TYPES.has(clue.type) && (clue.suspect === i || otherOf(clue) === i)),
  )
  const globals = puzzle.clues.filter((clue) => GLOBAL_TYPES.has(clue.type))
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
      const ok = puzzle.clues.every((clue) => evaluate(clue, puzzle, placement)) && killerOf(puzzle, placement) !== null
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
