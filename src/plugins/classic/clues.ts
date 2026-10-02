import { objectKindsIn } from '../../engine/candidates'
import type { ClueText, ClueTypeDef, PartialPlacement, ThemeDef } from '../../engine/plugin'
import type { Clue, Placement, Pos, Puzzle } from '../../engine/types'

type RoomClue = Clue & { room: number }
type KindClue = Clue & { kind: string }
type ColumnClue = Clue & { col: number }
type RowClue = Clue & { row: number }
type OtherClue = Clue & { other: number }
type OffsetClue = OtherClue & { delta: number }

const NEIGHBOR_STEPS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
]

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const roomOf = (puzzle: Puzzle, pos: Pos): number => puzzle.cells[pos.r][pos.c].room
const objectAt = (puzzle: Puzzle, pos: Pos): string | null => puzzle.cells[pos.r][pos.c].object
const nameOf = (puzzle: Puzzle, suspect: number): string => puzzle.suspects[suspect].name
const plural = (n: number, unit: string): string => `${NUMBER_WORDS[n] ?? n} ${unit}${n === 1 ? '' : 's'}`

function suspectsInRoom(puzzle: Puzzle, placement: Placement, room: number): number {
  return placement.filter((pos) => roomOf(puzzle, pos) === room).length
}

function isBesideObject(puzzle: Puzzle, pos: Pos, kind: string): boolean {
  const room = roomOf(puzzle, pos)
  return NEIGHBOR_STEPS.some(({ r, c }) => {
    const next = { r: pos.r + r, c: pos.c + c }
    const inBounds = next.r >= 0 && next.c >= 0 && next.r < puzzle.size && next.c < puzzle.size
    return inBounds && roomOf(puzzle, next) === room && objectAt(puzzle, next) === kind
  })
}

function placedWithSuspect(puzzle: Puzzle, assigned: PartialPlacement, suspect: number): number | null {
  const pos = assigned[suspect]
  if (!pos) return null
  const room = roomOf(puzzle, pos)
  return assigned.filter((p) => p !== undefined && roomOf(puzzle, p) === room).length
}

const perRoom =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    puzzle.rooms.map((_, room) => ({ type, suspect, room }))

const perKind =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    objectKindsIn(puzzle).map((kind) => ({ type, suspect, kind }))

const bare =
  (type: string) =>
  (_puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] => [{ type, suspect }]

const text = (value: string): ClueText => ({ kind: 'text', text: value })
const relation = (value: string, term: string): ClueText => ({ kind: 'relation', text: value, term })
const person = (puzzle: Puzzle, suspect: number): ClueText => ({ kind: 'person', text: nameOf(puzzle, suspect), suspect })
const roomText = (puzzle: Puzzle, room: number): ClueText => ({ kind: 'room', text: puzzle.rooms[room], room })

const ARTICLE = /^(an?|the) /

/** Splits a phrase around the object noun so the article stays plain and only the noun is the object. */
function objectParts(phrase: string, noun: string, kind: string): ClueText[] {
  const at = phrase.lastIndexOf(noun)
  if (at < 0) return [{ kind: 'object', text: phrase, object: kind }]
  const article = ARTICLE.exec(noun)?.[0] ?? ''
  const head = phrase.slice(0, at) + article
  const tail = phrase.slice(at + noun.length)
  return [
    ...(head ? [text(head)] : []),
    { kind: 'object', text: noun.slice(article.length), object: kind },
    ...(tail ? [text(tail)] : []),
  ]
}

const standingParts = (theme: ThemeDef, kind: string): ClueText[] =>
  objectParts(theme.objects[kind].standingOn, theme.objects[kind].noun, kind)
const nounParts = (theme: ThemeDef, kind: string): ClueText[] =>
  objectParts(theme.objects[kind].noun, theme.objects[kind].noun, kind)

const inRoom: ClueTypeDef = {
  id: 'inRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) === clue.room,
  parts: (clue: RoomClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in the '),
    roomText(puzzle, clue.room),
    text('.'),
  ],
  candidates: perRoom('inRoom'),
}

const notInRoom: ClueTypeDef = {
  id: 'notInRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) !== clue.room,
  terms: ['not'],
  parts: (clue: RoomClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' in the '),
    roomText(puzzle, clue.room),
    text('.'),
  ],
  candidates: perRoom('notInRoom'),
}

const onObject: ClueTypeDef = {
  id: 'onObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) === clue.kind,
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('onObject'),
}

const notOnObject: ClueTypeDef = {
  id: 'notOnObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) !== clue.kind,
  terms: ['not'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('notOnObject'),
}

const besideObject: ClueTypeDef = {
  id: 'besideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  terms: ['beside'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('beside', 'beside'),
    text(' '),
    ...nounParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('besideObject'),
}

const notBesideObject: ClueTypeDef = {
  id: 'notBesideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => !isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  terms: ['not', 'beside'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('not', 'not'),
    text(' '),
    relation('beside', 'beside'),
    text(' '),
    ...nounParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('notBesideObject'),
}

const inColumn: ClueTypeDef = {
  id: 'inColumn',
  scope: 'unary',
  evaluate: (clue: ColumnClue, _puzzle, placement) => placement[clue.suspect].c === clue.col,
  parts: (clue: ColumnClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    { kind: 'column', text: `column ${clue.col + 1}`, col: clue.col },
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) => [{ type: 'inColumn', suspect, col: placement[suspect].c }],
}

const inRow: ClueTypeDef = {
  id: 'inRow',
  scope: 'unary',
  evaluate: (clue: RowClue, _puzzle, placement) => placement[clue.suspect].r === clue.row,
  parts: (clue: RowClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    { kind: 'row', text: `row ${clue.row + 1}`, row: clue.row },
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) => [{ type: 'inRow', suspect, row: placement[suspect].r }],
}

const northOf: ClueTypeDef = {
  id: 'northOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].r === placement[clue.other].r - clue.delta,
  terms: ['north of'],
  parts: (clue: OffsetClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation(`${plural(clue.delta, 'row')} north of`, 'north of'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.r > placement[suspect].r
        ? [{ type: 'northOf', suspect, other: index, delta: other.r - placement[suspect].r }]
        : [],
    ),
}

const westOf: ClueTypeDef = {
  id: 'westOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].c === placement[clue.other].c - clue.delta,
  terms: ['west of'],
  parts: (clue: OffsetClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation(`${plural(clue.delta, 'column')} west of`, 'west of'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.c > placement[suspect].c
        ? [{ type: 'westOf', suspect, other: index, delta: other.c - placement[suspect].c }]
        : [],
    ),
}

const sameRoomAs: ClueTypeDef = {
  id: 'sameRoomAs',
  scope: 'binary',
  evaluate: (clue: OtherClue, puzzle, placement) =>
    roomOf(puzzle, placement[clue.suspect]) === roomOf(puzzle, placement[clue.other]),
  terms: ['same room'],
  parts: (clue: OtherClue, puzzle) => [
    person(puzzle, clue.suspect),
    text(' was in '),
    relation('the same room as', 'same room'),
    text(' '),
    person(puzzle, clue.other),
    text('.'),
  ],
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((_, index) => (index === suspect ? [] : [{ type: 'sameRoomAs', suspect, other: index }])),
}

const aloneInRoom: ClueTypeDef = {
  id: 'aloneInRoom',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 1,
  terms: ['alone'],
  parts: (clue, puzzle) => [person(puzzle, clue.suspect), text(' was '), relation('alone', 'alone'), text('.')],
  candidates: bare('aloneInRoom'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 1,
}

const withOneOther: ClueTypeDef = {
  id: 'withOneOther',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 2,
  terms: ['alone with the killer', 'exactly one other'],
  parts: (clue, puzzle) =>
    clue.suspect === puzzle.victim
      ? [
          person(puzzle, clue.suspect),
          text(' was '),
          relation('alone with the killer', 'alone with the killer'),
          text('.'),
        ]
      : [
          person(puzzle, clue.suspect),
          text(' was with '),
          relation('exactly one other person', 'exactly one other'),
          text('.'),
        ],
  candidates: bare('withOneOther'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 2,
  feasible(clue, puzzle, assigned, reachableByRoom) {
    const pos = assigned[clue.suspect]
    if (!pos) return true
    const room = roomOf(puzzle, pos)
    const present = assigned.filter((p) => p && roomOf(puzzle, p) === room).length
    return present >= 2 || reachableByRoom[room] >= 2 - present
  },
}

const onlyOnObject: ClueTypeDef = {
  id: 'onlyOnObject',
  scope: 'global',
  evaluate: (clue: KindClue, puzzle, placement) =>
    objectAt(puzzle, placement[clue.suspect]) === clue.kind &&
    placement.filter((p) => objectAt(puzzle, p) === clue.kind).length === 1,
  terms: ['only'],
  parts: (clue: KindClue, puzzle, theme) => [
    person(puzzle, clue.suspect),
    text(' was '),
    relation('the only person', 'only'),
    text(' '),
    ...standingParts(theme, clue.kind),
    text('.'),
  ],
  candidates: perKind('onlyOnObject'),
  prune: (clue: KindClue, puzzle, assigned) => assigned.filter((p) => p && objectAt(puzzle, p) === clue.kind).length <= 1,
}

export const CLUE_TYPES: readonly ClueTypeDef[] = [
  inRoom,
  notInRoom,
  onObject,
  notOnObject,
  besideObject,
  notBesideObject,
  inColumn,
  inRow,
  northOf,
  westOf,
  sameRoomAs,
  aloneInRoom,
  withOneOther,
  onlyOnObject,
]
