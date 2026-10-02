import { objectKindsIn } from '../../engine/candidates'
import type { ClueTypeDef, PartialPlacement, ThemeDef } from '../../engine/plugin'
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

const standingOn = (theme: ThemeDef, kind: string): string => theme.objects[kind].standingOn
const noun = (theme: ThemeDef, kind: string): string => theme.objects[kind].noun

const inRoom: ClueTypeDef = {
  id: 'inRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) === clue.room,
  render: (clue: RoomClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in the ${puzzle.rooms[clue.room]}.`,
  candidates: perRoom('inRoom'),
}

const notInRoom: ClueTypeDef = {
  id: 'notInRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) !== clue.room,
  render: (clue: RoomClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was not in the ${puzzle.rooms[clue.room]}.`,
  candidates: perRoom('notInRoom'),
}

const onObject: ClueTypeDef = {
  id: 'onObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) === clue.kind,
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was ${standingOn(theme, clue.kind)}.`,
  candidates: perKind('onObject'),
}

const notOnObject: ClueTypeDef = {
  id: 'notOnObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) !== clue.kind,
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was not ${standingOn(theme, clue.kind)}.`,
  candidates: perKind('notOnObject'),
}

const besideObject: ClueTypeDef = {
  id: 'besideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was beside ${noun(theme, clue.kind)}.`,
  candidates: perKind('besideObject'),
}

const notBesideObject: ClueTypeDef = {
  id: 'notBesideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => !isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was not beside ${noun(theme, clue.kind)}.`,
  candidates: perKind('notBesideObject'),
}

const inColumn: ClueTypeDef = {
  id: 'inColumn',
  scope: 'unary',
  evaluate: (clue: ColumnClue, _puzzle, placement) => placement[clue.suspect].c === clue.col,
  render: (clue: ColumnClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in column ${clue.col + 1}.`,
  candidates: (_puzzle, placement, suspect) => [{ type: 'inColumn', suspect, col: placement[suspect].c }],
}

const inRow: ClueTypeDef = {
  id: 'inRow',
  scope: 'unary',
  evaluate: (clue: RowClue, _puzzle, placement) => placement[clue.suspect].r === clue.row,
  render: (clue: RowClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in row ${clue.row + 1}.`,
  candidates: (_puzzle, placement, suspect) => [{ type: 'inRow', suspect, row: placement[suspect].r }],
}

const northOf: ClueTypeDef = {
  id: 'northOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].r === placement[clue.other].r - clue.delta,
  render: (clue: OffsetClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was ${plural(clue.delta, 'row')} north of ${nameOf(puzzle, clue.other)}.`,
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
  render: (clue: OffsetClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was ${plural(clue.delta, 'column')} west of ${nameOf(puzzle, clue.other)}.`,
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
  render: (clue: OtherClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was in the same room as ${nameOf(puzzle, clue.other)}.`,
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((_, index) => (index === suspect ? [] : [{ type: 'sameRoomAs', suspect, other: index }])),
}

const aloneInRoom: ClueTypeDef = {
  id: 'aloneInRoom',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 1,
  render: (clue, puzzle) => `${nameOf(puzzle, clue.suspect)} was alone.`,
  candidates: bare('aloneInRoom'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 1,
}

const withOneOther: ClueTypeDef = {
  id: 'withOneOther',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 2,
  render: (clue, puzzle) =>
    clue.suspect === puzzle.victim
      ? `${nameOf(puzzle, clue.suspect)} was alone with the killer.`
      : `${nameOf(puzzle, clue.suspect)} was with exactly one other person.`,
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
  render: (clue: KindClue, puzzle, theme) =>
    `${nameOf(puzzle, clue.suspect)} was the only person ${standingOn(theme, clue.kind)}.`,
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
