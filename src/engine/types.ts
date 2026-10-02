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

export type Pronoun = 'she' | 'he' | 'they'

/** Pins any part of a generated portrait; whatever is left out is chosen from the name. */
export interface PortraitLook {
  hairStyle?: string
  hairColor?: string
  skin?: string
  facialHair?: string
  shirt?: string
  glasses?: boolean
}

export interface Suspect {
  name: string
  pronoun: Pronoun
  look?: PortraitLook
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

export function isOccupiable(cell: Cell): boolean {
  return cell.object === null || !registry.objectKind(cell.object).blocking
}
