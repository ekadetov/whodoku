import type { SpriteDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import type { ObjectKind, Puzzle } from '../../engine/types'

export const spriteFor = (puzzle: Puzzle, kind: ObjectKind): SpriteDef =>
  registry.theme(puzzle.themeId).objects[kind].sprite
