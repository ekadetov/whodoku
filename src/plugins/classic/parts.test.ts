import { describe, expect, it } from 'vitest'
import { clueParts, renderClue } from '../../engine/clues'
import { tiny } from '../../engine/fixtures'
import type { ClueText } from '../../engine/plugin'
import type { Clue } from '../../engine/types'
import { classicTheme } from './theme'

const ANN = 0
const BOB = 1
const CY = 2
const DI = 3

const person = (suspect: number): ClueText => ({ kind: 'person', text: tiny.suspects[suspect].name, suspect })
const text = (t: string): ClueText => ({ kind: 'text', text: t })
const she = text('She')
const he = text('He')
const they = text('They')
const not: ClueText = { kind: 'relation', text: 'not', term: 'not' }
const beside: ClueText = { kind: 'relation', text: 'beside', term: 'beside' }

describe('clueParts', () => {
  const cases: [string, Clue, ClueText[]][] = [
    ['inRoom', { type: 'inRoom', suspect: BOB, room: 2 }, [he, text(' was in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')]],
    [
      'notInRoom',
      { type: 'notInRoom', suspect: BOB, room: 2 },
      [he, text(' was '), not, text(' in the '), { kind: 'room', text: 'Kitchen', room: 2 }, text('.')],
    ],
    [
      'onObject keeps the article outside the object',
      { type: 'onObject', suspect: BOB, kind: 'chair' },
      [he, text(' was '), text('sitting on a '), { kind: 'object', text: 'chair', object: 'chair' }, text('.')],
    ],
    [
      'onObject with the water',
      { type: 'onObject', suspect: DI, kind: 'water' },
      [she, text(' was '), text('in the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    [
      'notOnObject',
      { type: 'notOnObject', suspect: BOB, kind: 'rug' },
      [he, text(' was '), not, text(' '), text('on a '), { kind: 'object', text: 'rug', object: 'rug' }, text('.')],
    ],
    [
      'besideObject',
      { type: 'besideObject', suspect: ANN, kind: 'shelf' },
      [she, text(' was '), beside, text(' '), text('a '), { kind: 'object', text: 'shelf', object: 'shelf' }, text('.')],
    ],
    [
      'notBesideObject',
      { type: 'notBesideObject', suspect: ANN, kind: 'water' },
      [she, text(' was '), not, text(' '), beside, text(' '), text('the '), { kind: 'object', text: 'water', object: 'water' }, text('.')],
    ],
    ['inColumn', { type: 'inColumn', suspect: ANN, col: 1 }, [she, text(' was in '), { kind: 'column', text: 'column 2', col: 1 }, text('.')]],
    ['inRow', { type: 'inRow', suspect: ANN, row: 0 }, [she, text(' was in '), { kind: 'row', text: 'row 1', row: 0 }, text('.')]],
    [
      'northOf names the other suspect',
      { type: 'northOf', suspect: ANN, other: BOB, delta: 2 },
      [she, text(' was '), { kind: 'relation', text: 'two rows north of', term: 'north of' }, text(' '), person(BOB), text('.')],
    ],
    [
      'westOf',
      { type: 'westOf', suspect: BOB, other: ANN, delta: 1 },
      [he, text(' was '), { kind: 'relation', text: 'one column west of', term: 'west of' }, text(' '), person(ANN), text('.')],
    ],
    [
      'sameRoomAs',
      { type: 'sameRoomAs', suspect: ANN, other: BOB },
      [she, text(' was in '), { kind: 'relation', text: 'the same room as', term: 'same room' }, text(' '), person(BOB), text('.')],
    ],
    ['aloneInRoom', { type: 'aloneInRoom', suspect: BOB }, [he, text(' was '), { kind: 'relation', text: 'alone', term: 'alone' }, text('.')]],
    [
      'withOneOther',
      { type: 'withOneOther', suspect: BOB },
      [he, text(' was with '), { kind: 'relation', text: 'exactly one other person', term: 'exactly one other' }, text('.')],
    ],
    [
      'withOneOther for the victim',
      { type: 'withOneOther', suspect: ANN },
      [
        { kind: 'relation', text: 'The Victim.', term: 'victim' },
        text(' '),
        she,
        text(' was '),
        { kind: 'relation', text: 'alone with the murderer', term: 'alone with the murderer' },
        text('.'),
      ],
    ],
    [
      'onlyOnObject',
      { type: 'onlyOnObject', suspect: BOB, kind: 'chair' },
      [
        he,
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

  it('uses "were" for a suspect who goes by they', () => {
    expect(clueParts({ type: 'aloneInRoom', suspect: CY }, tiny)).toEqual([
      they,
      text(' were '),
      { kind: 'relation', text: 'alone', term: 'alone' },
      text('.'),
    ])
    expect(renderClue({ type: 'withOneOther', suspect: CY }, tiny)).toBe('They were with exactly one other person.')
    expect(renderClue({ type: 'inRoom', suspect: CY, room: 0 }, tiny)).toBe('They were in the Hall.')
  })

  it('joins into the same sentence renderClue returns', () => {
    for (const [, clue] of cases) {
      expect(renderClue(clue, tiny)).toBe(clueParts(clue, tiny).map((part) => part.text).join(''))
    }
  })
})

describe('classic glossary', () => {
  it('explains every relation term a clue can show', () => {
    const terms = [
      'not',
      'beside',
      'north of',
      'west of',
      'same room',
      'alone',
      'only',
      'exactly one other',
      'victim',
      'alone with the murderer',
    ]
    for (const term of terms) expect(classicTheme.glossary[term]).toBeTruthy()
  })
})
