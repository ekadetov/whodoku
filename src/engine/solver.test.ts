import { describe, expect, it } from 'vitest'
import { isSolved } from './clues'
import { pairs, tiny } from './fixtures'
import { countSolutions, solve } from './solver'
import type { Puzzle } from './types'

const withClues = (clues: Puzzle['clues']): Puzzle => ({ ...tiny, clues })

describe('solver', () => {
  it('finds the single solution of the tiny puzzle', () => {
    expect(countSolutions(tiny, 10)).toBe(1)
    expect(solve(tiny)).toEqual(pairs)
  })

  it('reports zero solutions for contradictory clues', () => {
    const impossible = withClues([
      { type: 'withOneOther', suspect: 0 },
      { type: 'onObject', suspect: 1, kind: 'chair' },
      { type: 'inColumn', suspect: 2, col: 3 },
      { type: 'onObject', suspect: 3, kind: 'water' },
    ])
    expect(countSolutions(impossible, 10)).toBe(0)
    expect(solve(impossible)).toBeNull()
  })

  it('stops counting at the limit when there are many solutions', () => {
    const loose = withClues([
      { type: 'withOneOther', suspect: 0 },
      { type: 'notOnObject', suspect: 1, kind: 'water' },
      { type: 'notOnObject', suspect: 2, kind: 'water' },
      { type: 'notOnObject', suspect: 3, kind: 'rug' },
    ])
    expect(countSolutions(loose, 1)).toBe(1)
    expect(countSolutions(loose, 3)).toBe(3)
  })

  it('handles relative and company clues', () => {
    const relative = withClues([
      { type: 'withOneOther', suspect: 0 },
      { type: 'northOf', suspect: 0, other: 1, delta: 1 },
      { type: 'aloneInRoom', suspect: 2 },
      { type: 'sameRoomAs', suspect: 3, other: 2 },
    ])
    expect(countSolutions(relative, 50)).toBe(0)
  })

  it('every returned solution satisfies all clues', () => {
    const loose = withClues([
      { type: 'withOneOther', suspect: 0 },
      { type: 'westOf', suspect: 1, other: 0, delta: 1 },
      { type: 'notOnObject', suspect: 2, kind: 'water' },
      { type: 'onlyOnObject', suspect: 3, kind: 'water' },
    ])
    const placement = solve(loose)
    expect(placement).not.toBeNull()
    expect(isSolved(loose, placement!)).toBe(true)
  })
})
