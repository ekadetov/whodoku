import type { Cell, ObjectKind, Placement, Puzzle } from './types'

const o = (room: number, object: ObjectKind | null = null): Cell => ({ room, object })

// Rooms: 0 Hall (top-left), 1 Study (top-right), 2 Kitchen (bottom-left), 3 Garden (bottom-right)
export const tiny: Puzzle = {
  size: 4,
  cells: [
    [o(0), o(0), o(1), o(1)],
    [o(0, 'chair'), o(0, 'shelf'), o(1, 'rug'), o(1)],
    [o(2, 'table'), o(2, 'chair'), o(3), o(3)],
    [o(2), o(2), o(3), o(3, 'water')],
  ],
  rooms: ['Hall', 'Study', 'Kitchen', 'Garden'],
  suspects: [
    { name: 'Ann', pronoun: 'she' },
    { name: 'Bob', pronoun: 'he' },
    { name: 'Cy', pronoun: 'they' },
    { name: 'Di', pronoun: 'she' },
  ],
  victim: 0,
  clues: [
    { type: 'withOneOther', suspect: 0 },
    { type: 'onObject', suspect: 1, kind: 'chair' },
    { type: 'inColumn', suspect: 2, col: 2 },
    { type: 'onObject', suspect: 3, kind: 'water' },
  ],
}

// Ann and Bob share the Hall, Cy and Di share the Garden. Ann is the victim, Bob the killer.
export const pairs: Placement = [
  { r: 0, c: 1 },
  { r: 1, c: 0 },
  { r: 2, c: 2 },
  { r: 3, c: 3 },
]

// Everyone alone in their own room.
export const lonely: Placement = [
  { r: 0, c: 1 },
  { r: 1, c: 2 },
  { r: 2, c: 3 },
  { r: 3, c: 0 },
]

// Bob and Cy both sit on chairs.
export const twoChairs: Placement = [
  { r: 0, c: 2 },
  { r: 1, c: 0 },
  { r: 2, c: 1 },
  { r: 3, c: 3 },
]
