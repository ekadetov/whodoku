import { registry } from './registry'

export type ObjectKind = string

export interface Pos {
  r: number
  c: number
}

export interface Cell {
  room: number
  object: ObjectKind | null
}

export interface Suspect {
  name: string
}

export type Placement = Pos[]

export type Clue =
  | { type: 'inRoom'; suspect: number; room: number }
  | { type: 'notInRoom'; suspect: number; room: number }
  | { type: 'onObject'; suspect: number; kind: ObjectKind }
  | { type: 'notOnObject'; suspect: number; kind: ObjectKind }
  | { type: 'besideObject'; suspect: number; kind: ObjectKind }
  | { type: 'notBesideObject'; suspect: number; kind: ObjectKind }
  | { type: 'inColumn'; suspect: number; col: number }
  | { type: 'inRow'; suspect: number; row: number }
  | { type: 'northOf'; suspect: number; other: number; delta: number }
  | { type: 'westOf'; suspect: number; other: number; delta: number }
  | { type: 'aloneInRoom'; suspect: number }
  | { type: 'withOneOther'; suspect: number }
  | { type: 'onlyOnObject'; suspect: number; kind: ObjectKind }
  | { type: 'sameRoomAs'; suspect: number; other: number }

export type ClueType = Clue['type']

export interface Puzzle {
  size: number
  cells: Cell[][]
  rooms: string[]
  suspects: Suspect[]
  victim: number
  clues: Clue[]
  themeId?: string
}

export type Tier = 'easy' | 'medium' | 'hard'

export function isOccupiable(cell: Cell): boolean {
  return cell.object === null || !registry.objectKind(cell.object).blocking
}
