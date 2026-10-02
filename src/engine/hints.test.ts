import { describe, expect, it } from 'vitest'
import { clueParts } from './clues'
import { tiny } from './fixtures'
import { hintTargets, suspectHints } from './hints'
import type { ClueText } from './plugin'
import type { Clue } from './types'

const ANN = 0
const BOB = 1

const targets = (clue: Clue) => hintTargets(clueParts(clue, tiny), tiny, clue.suspect)
const keys = (cells: { r: number; c: number }[]) => cells.map((p) => `${p.r},${p.c}`).sort()

describe('hintTargets', () => {
  it('lights every cell holding the named object', () => {
    const hint = targets({ type: 'onObject', suspect: BOB, kind: 'chair' })
    expect(keys(hint.cells)).toEqual(['1,0', '2,1'])
    expect(hint.rooms).toEqual([])
    expect(hint.suspects).toEqual([])
  })

  it('lights only the object for a beside clue, not its neighbors', () => {
    expect(keys(targets({ type: 'besideObject', suspect: ANN, kind: 'shelf' }).cells)).toEqual(['1,1'])
  })

  it('lights a whole room and reports it for the boundary outline', () => {
    const hint = targets({ type: 'inRoom', suspect: BOB, room: 2 })
    expect(keys(hint.cells)).toEqual(['2,0', '2,1', '3,0', '3,1'])
    expect(hint.rooms).toEqual([2])
  })

  it('lights a column or a row', () => {
    expect(keys(targets({ type: 'inColumn', suspect: ANN, col: 2 }).cells)).toEqual(['0,2', '1,2', '2,2', '3,2'])
    expect(keys(targets({ type: 'inRow', suspect: ANN, row: 0 }).cells)).toEqual(['0,0', '0,1', '0,2', '0,3'])
  })

  it('points at the other person, never at the clue subject', () => {
    const hint = targets({ type: 'northOf', suspect: ANN, other: BOB, delta: 1 })
    expect(hint.suspects).toEqual([BOB])
    expect(hint.cells).toEqual([])
  })

  it('lights nothing for company clues', () => {
    for (const clue of [
      { type: 'aloneInRoom', suspect: BOB },
      { type: 'withOneOther', suspect: ANN },
    ]) {
      expect(targets(clue)).toEqual({ cells: [], rooms: [], suspects: [] })
    }
  })

  it('combines every kind of target a clue names', () => {
    const parts: ClueText[] = [
      { kind: 'person', text: 'Ann', suspect: ANN },
      { kind: 'text', text: ' was near ' },
      { kind: 'person', text: 'Bob', suspect: BOB },
      { kind: 'object', text: 'chair', object: 'chair' },
      { kind: 'room', text: 'Hall', room: 0 },
    ]
    const hint = hintTargets(parts, tiny, ANN)
    expect(hint.suspects).toEqual([BOB])
    expect(hint.rooms).toEqual([0])
    expect(keys(hint.cells)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,1'])
  })
})

describe('suspectHints', () => {
  it('merges the targets of all of a suspect\'s clues without duplicates', () => {
    const puzzle = {
      ...tiny,
      clues: [
        { type: 'onObject', suspect: BOB, kind: 'chair' },
        { type: 'inRoom', suspect: BOB, room: 0 },
        { type: 'onObject', suspect: 2, kind: 'rug' },
      ],
    }
    const hint = suspectHints(puzzle, BOB)
    expect(keys(hint.cells)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,1'])
    expect(hint.rooms).toEqual([0])
  })

  it('is empty for a suspect with no clues', () => {
    expect(suspectHints({ ...tiny, clues: [] }, BOB)).toEqual({ cells: [], rooms: [], suspects: [] })
  })
})
