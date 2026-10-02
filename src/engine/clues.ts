import { isOccupiable } from './types'
import type { Clue, ClueType, ObjectKind, Placement, Pos, Puzzle } from './types'

const NON_UNARY_TYPES = new Set<ClueType>([
  'northOf',
  'westOf',
  'sameRoomAs',
  'aloneInRoom',
  'withOneOther',
  'onlyOnObject',
])

export function isUnaryClue(clue: Clue): boolean {
  return !NON_UNARY_TYPES.has(clue.type)
}

const NEIGHBOR_STEPS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
]

function roomOf(puzzle: Puzzle, pos: Pos): number {
  return puzzle.cells[pos.r][pos.c].room
}

function objectAt(puzzle: Puzzle, pos: Pos): ObjectKind | null {
  return puzzle.cells[pos.r][pos.c].object
}

function suspectsInRoom(puzzle: Puzzle, placement: Placement, room: number): number {
  return placement.filter((pos) => roomOf(puzzle, pos) === room).length
}

function isBesideObject(puzzle: Puzzle, pos: Pos, kind: ObjectKind): boolean {
  const room = roomOf(puzzle, pos)
  return NEIGHBOR_STEPS.some(({ r, c }) => {
    const next = { r: pos.r + r, c: pos.c + c }
    const inBounds = next.r >= 0 && next.c >= 0 && next.r < puzzle.size && next.c < puzzle.size
    return inBounds && roomOf(puzzle, next) === room && objectAt(puzzle, next) === kind
  })
}

export function evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean {
  const pos = placement[clue.suspect]
  switch (clue.type) {
    case 'inRoom':
      return roomOf(puzzle, pos) === clue.room
    case 'notInRoom':
      return roomOf(puzzle, pos) !== clue.room
    case 'onObject':
      return objectAt(puzzle, pos) === clue.kind
    case 'notOnObject':
      return objectAt(puzzle, pos) !== clue.kind
    case 'besideObject':
      return isBesideObject(puzzle, pos, clue.kind)
    case 'notBesideObject':
      return !isBesideObject(puzzle, pos, clue.kind)
    case 'inColumn':
      return pos.c === clue.col
    case 'inRow':
      return pos.r === clue.row
    case 'northOf':
      return pos.r === placement[clue.other].r - clue.delta
    case 'westOf':
      return pos.c === placement[clue.other].c - clue.delta
    case 'aloneInRoom':
      return suspectsInRoom(puzzle, placement, roomOf(puzzle, pos)) === 1
    case 'withOneOther':
      return suspectsInRoom(puzzle, placement, roomOf(puzzle, pos)) === 2
    case 'onlyOnObject':
      return (
        objectAt(puzzle, pos) === clue.kind &&
        placement.filter((p) => objectAt(puzzle, p) === clue.kind).length === 1
      )
    case 'sameRoomAs':
      return roomOf(puzzle, pos) === roomOf(puzzle, placement[clue.other])
  }
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const OBJECT_NOUN: Record<ObjectKind, string> = {
  chair: 'a chair',
  rug: 'a rug',
  water: 'the water',
  table: 'a table',
  shelf: 'a shelf',
  plant: 'a plant',
  rock: 'a rock',
  tree: 'a tree',
  tv: 'a TV',
}

const STANDING_ON: Record<ObjectKind, string> = {
  chair: 'sitting on a chair',
  rug: 'on a rug',
  water: 'in the water',
  table: 'on a table',
  shelf: 'on a shelf',
  plant: 'on a plant',
  rock: 'on a rock',
  tree: 'on a tree',
  tv: 'on a TV',
}

export function renderClue(clue: Clue, puzzle: Puzzle): string {
  const name = puzzle.suspects[clue.suspect].name
  const otherName = (other: number) => puzzle.suspects[other].name
  const plural = (n: number, unit: string) => `${NUMBER_WORDS[n] ?? n} ${unit}${n === 1 ? '' : 's'}`
  switch (clue.type) {
    case 'inRoom':
      return `${name} was in the ${puzzle.rooms[clue.room]}.`
    case 'notInRoom':
      return `${name} was not in the ${puzzle.rooms[clue.room]}.`
    case 'onObject':
      return `${name} was ${STANDING_ON[clue.kind]}.`
    case 'notOnObject':
      return `${name} was not ${STANDING_ON[clue.kind]}.`
    case 'besideObject':
      return `${name} was beside ${OBJECT_NOUN[clue.kind]}.`
    case 'notBesideObject':
      return `${name} was not beside ${OBJECT_NOUN[clue.kind]}.`
    case 'inColumn':
      return `${name} was in column ${clue.col + 1}.`
    case 'inRow':
      return `${name} was in row ${clue.row + 1}.`
    case 'northOf':
      return `${name} was ${plural(clue.delta, 'row')} north of ${otherName(clue.other)}.`
    case 'westOf':
      return `${name} was ${plural(clue.delta, 'column')} west of ${otherName(clue.other)}.`
    case 'aloneInRoom':
      return `${name} was alone.`
    case 'withOneOther':
      return clue.suspect === puzzle.victim
        ? `${name} was alone with the killer.`
        : `${name} was with exactly one other person.`
    case 'onlyOnObject':
      return `${name} was the only person ${STANDING_ON[clue.kind]}.`
    case 'sameRoomAs':
      return `${name} was in the same room as ${otherName(clue.other)}.`
  }
}

export function isLegalPlacement(puzzle: Puzzle, placement: Placement): boolean {
  if (placement.length !== puzzle.size) return false
  const rows = new Set<number>()
  const cols = new Set<number>()
  for (const { r, c } of placement) {
    const inBounds = r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size
    if (!inBounds || !isOccupiable(puzzle.cells[r][c])) return false
    rows.add(r)
    cols.add(c)
  }
  return rows.size === puzzle.size && cols.size === puzzle.size
}

export function killerOf(puzzle: Puzzle, placement: Placement): number | null {
  const room = roomOf(puzzle, placement[puzzle.victim])
  const others = placement
    .map((pos, i) => ({ i, room: roomOf(puzzle, pos) }))
    .filter((s) => s.i !== puzzle.victim && s.room === room)
  return others.length === 1 ? others[0].i : null
}

export function isSolved(puzzle: Puzzle, placement: Placement): boolean {
  return (
    isLegalPlacement(puzzle, placement) &&
    killerOf(puzzle, placement) !== null &&
    puzzle.clues.every((clue) => evaluate(clue, puzzle, placement))
  )
}
