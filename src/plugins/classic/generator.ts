import { candidateClues } from '../../engine/candidates'
import { evaluate, isUnaryClue } from '../../engine/clues'
import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { mulberry32, pick, shuffle } from '../../engine/rng'
import type { Rng } from '../../engine/rng'
import { countSolutions, findSolutions } from '../../engine/solver'
import { isOccupiable } from '../../engine/types'
import type { Cell, Clue, Placement, Pos, Puzzle } from '../../engine/types'
import { generateLayout } from './layout'

export type Tier = 'easy' | 'medium' | 'hard'

export interface TierConfig {
  size: number
  roomCount: number
  allowed: readonly string[]
  softenPasses: number
}

const DIRECT: readonly string[] = [
  'inRoom',
  'notInRoom',
  'onObject',
  'besideObject',
  'inColumn',
  'inRow',
  'aloneInRoom',
]
const INTERMEDIATE: readonly string[] = [
  ...DIRECT,
  'notOnObject',
  'notBesideObject',
  'sameRoomAs',
  'northOf',
  'westOf',
  'withOneOther',
]
const ADVANCED: readonly string[] = [...INTERMEDIATE, 'onlyOnObject']

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  easy: { size: 6, roomCount: 6, allowed: DIRECT, softenPasses: 0 },
  medium: { size: 8, roomCount: 8, allowed: INTERMEDIATE, softenPasses: 1 },
  hard: { size: 9, roomCount: 9, allowed: ADVANCED, softenPasses: 1 },
}

const ALTERNATIVE_CAP = 60
const CANDIDATE_SAMPLE = 12
const MAX_CLUES_PER_SUSPECT = 2
const FILL_SAMPLES = 6
const SOFTEN_SAMPLES = 4
const MAX_ATTEMPTS = 60
const SEARCH_BUDGET = 4000
const FINAL_CHECK_BUDGET = 2_000_000

interface Candidate {
  clue: Clue
  looseness: number
}

function randomPositions(rng: Rng, cells: Cell[][]): Pos[] | null {
  const size = cells.length
  const columnUsed = new Array<boolean>(size).fill(false)
  const positions: Pos[] = []
  const columns = Array.from({ length: size }, (_, c) => c)
  const place = (r: number): boolean => {
    if (r === size) return true
    for (const c of shuffle(rng, columns)) {
      if (columnUsed[c] || !isOccupiable(cells[r][c])) continue
      columnUsed[c] = true
      positions.push({ r, c })
      if (place(r + 1)) return true
      positions.pop()
      columnUsed[c] = false
    }
    return false
  }
  return place(0) ? positions : null
}

function looseness(puzzle: Puzzle, placement: Placement, clue: Clue, occupiable: number): number {
  if (!isUnaryClue(clue)) return occupiable * 0.6
  let holds = 0
  const probe: Placement = [...placement]
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      if (!isOccupiable(puzzle.cells[r][c])) continue
      probe[clue.suspect] = { r, c }
      if (evaluate(clue, puzzle, probe)) holds++
    }
  }
  return holds
}

function samePlacement(a: Placement, b: Placement): boolean {
  return a.every((pos, i) => pos.r === b[i].r && pos.c === b[i].c)
}

function sample<T>(rng: Rng, items: readonly T[], n: number): T[] {
  return items.length <= n ? [...items] : shuffle(rng, items).slice(0, n)
}

function selectClues(rng: Rng, puzzle: Puzzle, placement: Placement, config: TierConfig): boolean {
  const allowed = new Set(config.allowed)
  const occupiable = puzzle.cells.flat().filter(isOccupiable).length
  const victimClue: Clue = { type: 'withOneOther', suspect: puzzle.victim }

  const candidates: Candidate[][] = puzzle.suspects.map((_, s) =>
    candidateClues(puzzle, placement, s, allowed)
      .filter((clue) => s !== puzzle.victim || clue.type !== 'withOneOther')
      .map((clue) => ({ clue, looseness: looseness(puzzle, placement, clue, occupiable) })),
  )

  const chosen: Clue[] = [victimClue]
  const countFor = (s: number) => chosen.filter((clue) => clue.suspect === s).length
  const asPuzzle = (clues: Clue[]): Puzzle => ({ ...puzzle, clues })
  const alternatives = () =>
    findSolutions(asPuzzle(chosen), ALTERNATIVE_CAP + 1, { rng, nodeBudget: SEARCH_BUDGET }).filter((p) => !samePlacement(p, placement))

  let others = alternatives()
  while (others.length > 0) {
    let best: Clue | null = null
    let bestKilled = 0
    for (let s = 0; s < puzzle.size; s++) {
      if (countFor(s) >= MAX_CLUES_PER_SUSPECT) continue
      for (const { clue } of sample(rng, candidates[s], CANDIDATE_SAMPLE)) {
        const killed = others.filter((alt) => !evaluate(clue, puzzle, alt)).length
        if (killed > bestKilled) {
          best = clue
          bestKilled = killed
        }
      }
    }
    if (!best) return false
    chosen.push(best)
    others = alternatives()
  }
  for (let s = 0; s < puzzle.size; s++) {
    if (countFor(s) > 0 || candidates[s].length === 0) continue
    const options = sample(rng, candidates[s], FILL_SAMPLES)
    chosen.push(options.reduce((a, b) => (b.looseness > a.looseness ? b : a)).clue)
  }
  if (puzzle.suspects.some((_, s) => countFor(s) === 0)) return false

  if (config.softenPasses > 0) {
    for (const clue of shuffle(rng, chosen)) {
      if (clue === victimClue || countFor(clue.suspect) < 2) continue
      const without = chosen.filter((c) => c !== clue)
      if (countSolutions(asPuzzle(without), 2, SEARCH_BUDGET) === 1) chosen.splice(chosen.indexOf(clue), 1)
    }
  }
  for (let pass = 0; pass < config.softenPasses; pass++) {
    for (const clue of shuffle(rng, chosen)) {
      if (clue === victimClue) continue
      const index = chosen.indexOf(clue)
      const clueLooseness = looseness(puzzle, placement, clue, occupiable)
      const looser = candidates[clue.suspect].filter((c) => c.looseness > clueLooseness)
      for (let k = 0; k < SOFTEN_SAMPLES && looser.length > 0; k++) {
        chosen[index] = pick(rng, looser).clue
        if (countSolutions(asPuzzle(chosen), 2, SEARCH_BUDGET) === 1) break
        chosen[index] = clue
      }
    }
  }
  puzzle.clues = [...chosen].sort((a, b) => a.suspect - b.suspect)
  return countSolutions(puzzle, 2, FINAL_CHECK_BUDGET) === 1
}

function attemptPuzzle(rng: Rng, config: TierConfig, theme: ThemeDef): Puzzle | null {
  const { size, roomCount } = config
  if (theme.suspects.length < size) throw new Error(`Theme "${theme.id}" has fewer than ${size} suspects`)
  const layout = generateLayout(rng, size, roomCount, theme)
  const positions = randomPositions(rng, layout.cells)
  if (!positions) return null

  const placement = shuffle(rng, positions)
  const roomOf = (pos: Pos) => layout.cells[pos.r][pos.c].room
  const eligible = placement
    .map((_, i) => i)
    .filter((i) => placement.filter((p) => roomOf(p) === roomOf(placement[i])).length === 2)
  if (eligible.length === 0) return null

  const puzzle: Puzzle = {
    size,
    cells: layout.cells,
    rooms: layout.rooms,
    suspects: shuffle(rng, theme.suspects)
      .slice(0, size)
      .map((suspect) => ({ ...suspect })),
    victim: pick(rng, eligible),
    clues: [],
    themeId: theme.id,
  }
  return selectClues(rng, puzzle, placement, config) ? puzzle : null
}

export function generate(seed: number, tier: Tier, themeId?: string): Puzzle {
  const config = TIER_CONFIG[tier]
  const theme = registry.theme(themeId)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0)
    const puzzle = attemptPuzzle(rng, config, theme)
    if (puzzle) return puzzle
  }
  throw new Error(`Could not generate a ${tier} puzzle for seed ${seed}`)
}
