import { describe, expect, it } from 'vitest'
import { isLegalPlacement, isSolved, killerOf } from './clues'
import { TIER_CONFIG, generate } from './generator'
import { countSolutions, solve } from './solver'
import type { Tier } from './types'

const TIERS: Tier[] = ['easy', 'medium', 'hard']
const SEEDS = Array.from({ length: 15 }, (_, i) => 1000 + i * 7919)

describe.each(TIERS)('generate (%s)', (tier) => {
  const config = TIER_CONFIG[tier]

  it('produces valid puzzles with exactly one solution', () => {
    for (const seed of SEEDS) {
      const puzzle = generate(seed, tier)
      expect(puzzle.size).toBe(config.size)
      expect(puzzle.suspects).toHaveLength(config.size)
      expect(new Set(puzzle.suspects.map((s) => s.name)).size).toBe(config.size)
      expect(puzzle.clues).toContainEqual({ type: 'withOneOther', suspect: puzzle.victim })
      puzzle.suspects.forEach((_, s) => {
        const own = puzzle.clues.filter((clue) => clue.suspect === s).length
        expect(own).toBeGreaterThanOrEqual(1)
        expect(own).toBeLessThanOrEqual(2)
      })
      expect(puzzle.clues.map((clue) => clue.suspect)).toEqual(
        [...puzzle.clues.map((clue) => clue.suspect)].sort((a, b) => a - b),
      )

      expect(countSolutions(puzzle, 2)).toBe(1)
      const placement = solve(puzzle)!
      expect(isLegalPlacement(puzzle, placement)).toBe(true)
      expect(isSolved(puzzle, placement)).toBe(true)
      expect(killerOf(puzzle, placement)).not.toBeNull()
    }
  })

  it('is deterministic for a seed and varies across seeds', () => {
    expect(JSON.stringify(generate(SEEDS[0], tier))).toBe(JSON.stringify(generate(SEEDS[0], tier)))
    expect(JSON.stringify(generate(SEEDS[0], tier))).not.toBe(JSON.stringify(generate(SEEDS[1], tier)))
  })
})

describe('generation speed', () => {
  it.each(TIERS)('%s median under budget', (tier) => {
    const times = SEEDS.map((seed) => {
      const start = performance.now()
      generate(seed, tier)
      return performance.now() - start
    }).sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]
    console.log(`${tier}: median ${median.toFixed(0)} ms, max ${times[times.length - 1].toFixed(0)} ms`)
    expect(median).toBeLessThan(250)
  })
})
