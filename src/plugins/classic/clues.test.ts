import { describe, expect, it } from 'vitest'
import { answerOf, evaluate, isLegalPlacement, isSolved, renderClue } from '../../engine/clues'
import { lonely, pairs, tiny, twoChairs } from '../../engine/fixtures'
import type { Clue, Placement } from '../../engine/types'

const ANN = 0
const BOB = 1
const CY = 2
const DI = 3

type Case = [string, Clue, Placement, boolean]

const cases: Case[] = [
  ['inRoom true', { type: 'inRoom', suspect: ANN, room: 0 }, pairs, true],
  ['inRoom false', { type: 'inRoom', suspect: CY, room: 0 }, pairs, false],
  ['notInRoom true', { type: 'notInRoom', suspect: ANN, room: 1 }, pairs, true],
  ['notInRoom false', { type: 'notInRoom', suspect: ANN, room: 0 }, pairs, false],
  ['onObject true', { type: 'onObject', suspect: BOB, kind: 'chair' }, pairs, true],
  ['onObject false', { type: 'onObject', suspect: ANN, kind: 'chair' }, pairs, false],
  ['notOnObject true', { type: 'notOnObject', suspect: ANN, kind: 'chair' }, pairs, true],
  ['notOnObject false', { type: 'notOnObject', suspect: BOB, kind: 'chair' }, pairs, false],
  ['besideObject true', { type: 'besideObject', suspect: ANN, kind: 'shelf' }, pairs, true],
  ['besideObject false', { type: 'besideObject', suspect: CY, kind: 'shelf' }, pairs, false],
  [
    'besideObject ignores a neighbor in another room',
    { type: 'besideObject', suspect: BOB, kind: 'table' },
    pairs,
    false,
  ],
  ['besideObject ignores the own cell', { type: 'besideObject', suspect: BOB, kind: 'chair' }, pairs, false],
  ['notBesideObject true', { type: 'notBesideObject', suspect: BOB, kind: 'table' }, pairs, true],
  ['notBesideObject false', { type: 'notBesideObject', suspect: ANN, kind: 'shelf' }, pairs, false],
  ['inColumn true', { type: 'inColumn', suspect: ANN, col: 1 }, pairs, true],
  ['inColumn false', { type: 'inColumn', suspect: ANN, col: 0 }, pairs, false],
  ['inRow true', { type: 'inRow', suspect: ANN, row: 0 }, pairs, true],
  ['inRow false', { type: 'inRow', suspect: ANN, row: 1 }, pairs, false],
  ['northOf true', { type: 'northOf', suspect: ANN, other: BOB, delta: 1 }, pairs, true],
  ['northOf false', { type: 'northOf', suspect: ANN, other: CY, delta: 1 }, pairs, false],
  ['northOf delta 2', { type: 'northOf', suspect: ANN, other: CY, delta: 2 }, pairs, true],
  ['westOf true', { type: 'westOf', suspect: BOB, other: ANN, delta: 1 }, pairs, true],
  ['westOf false', { type: 'westOf', suspect: ANN, other: BOB, delta: 1 }, pairs, false],
  ['aloneInRoom false when shared', { type: 'aloneInRoom', suspect: ANN }, pairs, false],
  ['aloneInRoom true when alone', { type: 'aloneInRoom', suspect: ANN }, lonely, true],
  ['withOneOther true', { type: 'withOneOther', suspect: ANN }, pairs, true],
  ['withOneOther false when alone', { type: 'withOneOther', suspect: ANN }, lonely, false],
  ['onlyOnObject true', { type: 'onlyOnObject', suspect: BOB, kind: 'chair' }, pairs, true],
  ['onlyOnObject false when not on it', { type: 'onlyOnObject', suspect: ANN, kind: 'chair' }, pairs, false],
  ['onlyOnObject false when shared', { type: 'onlyOnObject', suspect: BOB, kind: 'chair' }, twoChairs, false],
  ['onlyOnObject water', { type: 'onlyOnObject', suspect: DI, kind: 'water' }, pairs, true],
  ['sameRoomAs true', { type: 'sameRoomAs', suspect: ANN, other: BOB }, pairs, true],
  ['sameRoomAs false', { type: 'sameRoomAs', suspect: ANN, other: CY }, pairs, false],
]

describe('evaluate', () => {
  it.each(cases)('%s', (_name, clue, placement, expected) => {
    expect(evaluate(clue, tiny, placement)).toBe(expected)
  })
})

describe('renderClue', () => {
  const text = (clue: Clue) => renderClue(clue, tiny)

  it('renders room clues', () => {
    expect(text({ type: 'inRoom', suspect: BOB, room: 2 })).toBe('He was in the Kitchen.')
    expect(text({ type: 'notInRoom', suspect: BOB, room: 2 })).toBe('He was not in the Kitchen.')
    expect(text({ type: 'sameRoomAs', suspect: ANN, other: BOB })).toBe('She was in the same room as Bob.')
  })

  it('renders object clues', () => {
    expect(text({ type: 'onObject', suspect: BOB, kind: 'chair' })).toBe('He was sitting on a chair.')
    expect(text({ type: 'notOnObject', suspect: BOB, kind: 'rug' })).toBe('He was not on a rug.')
    expect(text({ type: 'onObject', suspect: DI, kind: 'water' })).toBe('She was in the water.')
    expect(text({ type: 'besideObject', suspect: ANN, kind: 'shelf' })).toBe('She was beside a shelf.')
    expect(text({ type: 'notBesideObject', suspect: ANN, kind: 'water' })).toBe('She was not beside the water.')
    expect(text({ type: 'onlyOnObject', suspect: BOB, kind: 'chair' })).toBe(
      'He was the only person sitting on a chair.',
    )
  })

  it('renders position clues with 1-based indices', () => {
    expect(text({ type: 'inColumn', suspect: ANN, col: 1 })).toBe('She was in column 2.')
    expect(text({ type: 'inRow', suspect: ANN, row: 0 })).toBe('She was in row 1.')
    expect(text({ type: 'northOf', suspect: ANN, other: BOB, delta: 1 })).toBe('She was one row north of Bob.')
    expect(text({ type: 'northOf', suspect: ANN, other: CY, delta: 2 })).toBe('She was two rows north of Cy.')
    expect(text({ type: 'westOf', suspect: BOB, other: ANN, delta: 3 })).toBe('He was three columns west of Ann.')
  })

  it('renders company clues, special-casing the victim', () => {
    expect(text({ type: 'aloneInRoom', suspect: BOB })).toBe('He was alone.')
    expect(text({ type: 'withOneOther', suspect: ANN })).toBe('The Victim. She was alone with the murderer.')
    expect(text({ type: 'withOneOther', suspect: BOB })).toBe('He was with exactly one other person.')
  })
})

describe('isLegalPlacement', () => {
  it('accepts a valid placement', () => {
    expect(isLegalPlacement(tiny, pairs)).toBe(true)
  })

  it('rejects a shared row', () => {
    expect(isLegalPlacement(tiny, [{ r: 0, c: 1 }, { r: 0, c: 0 }, ...pairs.slice(2)])).toBe(false)
  })

  it('rejects a shared column', () => {
    expect(isLegalPlacement(tiny, [{ r: 0, c: 1 }, { r: 1, c: 1 }, ...pairs.slice(2)])).toBe(false)
  })

  it('rejects a blocking cell', () => {
    expect(isLegalPlacement(tiny, [{ r: 0, c: 0 }, { r: 1, c: 1 }, ...pairs.slice(2)])).toBe(false)
  })

  it('rejects out-of-bounds and wrong length', () => {
    expect(isLegalPlacement(tiny, [{ r: 0, c: 4 }, ...pairs.slice(1)])).toBe(false)
    expect(isLegalPlacement(tiny, pairs.slice(0, 3))).toBe(false)
  })
})

describe('answerOf', () => {
  it('returns the other suspect in the victim room', () => {
    expect(answerOf(tiny, pairs)).toBe(BOB)
  })

  it('returns null when the victim is alone', () => {
    expect(answerOf(tiny, lonely)).toBeNull()
  })
})

describe('isSolved', () => {
  it('is true when legal and every clue holds', () => {
    expect(isSolved(tiny, pairs)).toBe(true)
  })

  it('is false when a clue fails', () => {
    expect(isSolved(tiny, twoChairs)).toBe(false)
  })
})
