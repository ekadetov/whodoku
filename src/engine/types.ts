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

export interface Clue {
  type: string
  suspect: number
  [field: string]: unknown
}

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
