import type { Clue, Placement, Pos, Puzzle, Suspect } from './types'

export type ClueScope = 'unary' | 'binary' | 'global'

export type PartialPlacement = (Pos | undefined)[]

export type PaintMode = 'mark' | 'unmark' | 'erase'

export interface ObjectKindDef {
  id: string
  blocking: boolean
  footprint?: readonly Pos[]
}

interface Paint {
  fill?: string
  stroke?: string
  sw?: number
}

/** Drawing instructions on a 100 x 100 canvas. Plain data, so a theme can be shipped as JSON. */
export type SpriteShape =
  | ({ kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number } & Paint)
  | ({ kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint)
  | ({ kind: 'path'; d: string } & Paint)

export interface SpriteDef {
  shapes: readonly SpriteShape[]
}

export interface ThemeObject {
  label: string
  noun: string
  standingOn: string
  sprite: SpriteDef
  weight: number
}

export interface ThemeDef {
  id: string
  rooms: readonly string[]
  suspects: readonly Suspect[]
  objects: Readonly<Record<string, ThemeObject>>
  /** One-line explanations for the relation words clues use, keyed by `ClueText` term. */
  glossary: Readonly<Record<string, string>>
}

/** A clue sentence as pieces, so the UI can bold words, explain them and highlight what they name. */
export type ClueText =
  | { kind: 'text'; text: string }
  | { kind: 'relation'; text: string; term: string }
  | { kind: 'object'; text: string; object: string }
  | { kind: 'room'; text: string; room: number }
  | { kind: 'person'; text: string; suspect: number }
  | { kind: 'column'; text: string; col: number }
  | { kind: 'row'; text: string; row: number }

export interface ClueTypeDef {
  id: string
  scope: ClueScope
  evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean
  parts(clue: Clue, puzzle: Puzzle, theme: ThemeDef): ClueText[]
  /** Glossary terms the parts can contain; every registered theme must explain them. */
  terms?: readonly string[]
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
