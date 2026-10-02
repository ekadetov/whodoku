import { describe, expect, it } from 'vitest'
import { clueParts, renderClue } from '../../engine/clues'
import { tiny } from '../../engine/fixtures'
import type { ClueText } from '../../engine/plugin'
import type { Clue } from '../../engine/types'
import { classicTheme } from './theme'

const ANN = 0
const BOB = 1
const DI = 3

const person = (suspect: number): ClueText => ({ kind: 'person', text: tiny.suspects[suspect].name, suspect })
const text = (t: string): ClueText => ({ kind: 'text', text: t })

describe('clueParts', () => {
  const cases: [string, Clue, ClueText[]][] = [
    ['inRoom', { type: 'inRoom', suspect: BOB, room: 2 }, [person(BOB), text(' was in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')]],
    [
      'notInRoom',
      { type: 'notInRoom', suspect: BOB, room: 2 },
      [person(BOB), text(' was '), { kind: 'relation', text: 'not', term: 'not' }, text(' in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')],
    ],
    [
      'onObject keeps the article outside the object',
      { type: 'onObject', suspect: BOB, kind: 'chair' },
      [person(BOB), text(' was '), text('sitting on a '), { kind: 'object', text: 'chair', object: 'chair' }, text('.')],
    ],
    [
      'onObject with the water',
      { type: 'onObject', suspect: DI, kind: 'water' },
      [person(DI), text(' was '), text('in the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    [
      'notOnObject',
      { type: 'notOnObject', suspect: BOB, kind: 'rug' },
      [person(BOB), text(' was '), { kind: 'relation', text: 'not', term: 'not' }, text(' '), text('on a '), { kind: 'object', text: 'rug', object: 'rug' }, text('.')],
    ],
    [
      'besideObject',
      { type: 'besideObject', suspect: ANN, kind: 'shelf' },
      [person(ANN), text(' was '), { kind: 'relation', text: 'beside', term: 'beside' }, text(' '), text('a '), { kind: 'object', text: 'shelf', object: 'shelf' }, text('.')],
    ],
    [
      'notBesideObject',
      { type: 'notBesideObject', suspect: ANN, kind: 'water' },
      [
        person(ANN),
        text(' was '),
        { kind: 'relation', text: 'not', term: 'not' },
        text(' '),
        { kind: 'relation', text: 'beside', term: 'beside' },
        text(' '),
        text('the '),
        { kind: 'object', text: 'water', object: 'water' },
        text('.'),
      ],
    ],
    ['inColumn', { type: 'inColumn', suspect: ANN, col: 1 }, [person(ANN), text(' was in '), { kind: 'column', text: 'column 2', col: 1 }, text('.')]],
    ['inRow', { type: 'inRow', suspect: ANN, row: 0 }, [person(ANN), text(' was in '), { kind: 'row', text: 'row 1', row: 0 }, text('.')]],
    [
      'northOf',
      { type: 'northOf', suspect: ANN, other: BOB, delta: 2 },
      [person(ANN), text(' was '), { kind: 'relation', text: 'two rows north of', term: 'north of' }, text(' '), person(BOB), text('.')],
    ],
    [
      'westOf',
      { type: 'westOf', suspect: BOB, other: ANN, delta: 1 },
      [person(BOB), text(' was '), { kind: 'relation', text: 'one column west of', term: 'west of' }, text(' '), person(ANN), text('.')],
    ],
    [
      'sameRoomAs',
      { type: 'sameRoomAs', suspect: ANN, other: BOB },
      [person(ANN), text(' was in '), { kind: 'relation', text: 'the same room as', term: 'same room' }, text(' '), person(BOB), text('.')],
    ],
    ['aloneInRoom', { type: 'aloneInRoom', suspect: BOB }, [person(BOB), text(' was '), { kind: 'relation', text: 'alone', term: 'alone' }, text('.')]],
    [
      'withOneOther',
      { type: 'withOneOther', suspect: BOB },
      [person(BOB), text(' was with '), { kind: 'relation', text: 'exactly one other person', term: 'exactly one other' }, text('.')],
    ],
    [
      'withOneOther for the victim',
      { type: 'withOneOther', suspect: ANN },
      [person(ANN), text(' was '), { kind: 'relation', text: 'alone with the killer', term: 'alone with the killer' }, text('.')],
    ],
    [
      'onlyOnObject',
      { type: 'onlyOnObject', suspect: BOB, kind: 'chair' },
      [
        person(BOB),
        text(' was '),
        { kind: 'relation', text: 'the only person', term: 'only' },
        text(' '),
        text('sitting on a '),
        { kind: 'object', text: 'chair', object: 'chair' },
        text('.'),
      ],
    ],
  ]

  it.each(cases)('%s', (_name, clue, expected) => {
    expect(clueParts(clue, tiny)).toEqual(expected)
  })

  it('joins into the same sentence renderClue returns', () => {
    for (const [, clue] of cases) {
      expect(renderClue(clue, tiny)).toBe(clueParts(clue, tiny).map((part) => part.text).join(''))
    }
  })
})

describe('classic glossary', () => {
  it('explains every relation term a clue can show', () => {
    const terms = ['not', 'beside', 'north of', 'west of', 'same room', 'alone', 'only', 'exactly one other', 'alone with the killer']
    for (const term of terms) expect(classicTheme.glossary[term]).toBeTruthy()
  })
})
