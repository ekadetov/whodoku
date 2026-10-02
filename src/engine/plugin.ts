import type { Clue, Placement, Pos, Puzzle } from './types'

export type ClueScope = 'unary' | 'binary' | 'global'

export type PartialPlacement = (Pos | undefined)[]

export type PaintMode = 'mark' | 'unmark' | 'erase'

export interface ObjectKindDef {
  id: string
  blocking: boolean
  footprint?: readonly Pos[]
}

export interface ThemeObject {
  noun: string
  standingOn: string
  glyph: string
  weight: number
}

export interface ThemeDef {
  id: string
  rooms: readonly string[]
  suspects: readonly string[]
  objects: Readonly<Record<string, ThemeObject>>
}

export interface ClueTypeDef {
  id: string
  scope: ClueScope
  evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean
  render(clue: Clue, puzzle: Puzzle, theme: ThemeDef): string
  candidates?(puzzle: Puzzle, placement: Placement, suspect: number): Clue[]
  prune?(clue: Clue, puzzle: Puzzle, assigned: PartialPlacement): boolean
  feasible?(clue: Clue, puzzle: Puzzle, assigned: PartialPlacement, reachableByRoom: number[]): boolean
}

export interface RuleDef {
  id: string
  check(puzzle: Puzzle, placement: Placement): boolean
  answer?(puzzle: Puzzle, placement: Placement): number | null
}

export interface PaintStart {
  marked: boolean
  occupied: boolean
}

export interface ToolDef {
  id: string
  label: string
  /** Present on stroke tools: decides what a drag does from the state of the first cell. */
  paint?(start: PaintStart): PaintMode
  holdToClear?: boolean
}

export interface PuzzleSourceDef {
  id: string
  get(dateKey: string): Puzzle
}

export interface PluginApi {
  addObjectKind(def: ObjectKindDef): void
  addClueType(def: ClueTypeDef): void
  addRule(def: RuleDef): void
  addTheme(def: ThemeDef): void
  addTool(def: ToolDef): void
  addPuzzleSource(def: PuzzleSourceDef): void
}

export interface Plugin {
  id: string
  version: string
  requires?: readonly string[]
  register(api: PluginApi): void
}
