import type { SpriteShape } from '../../../engine/plugin'
import type { Pronoun } from '../../../engine/types'
import { INK } from './palette'

export interface HairLayers {
  /** Drawn behind the neck and face, over the shoulders. */
  back: SpriteShape[]
  /** Drawn over the face. */
  front: SpriteShape[]
  /** Whether the ears stay visible. */
  ears: boolean
}

const path = (d: string, fill: string, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke: INK, sw })
const blob = (cx: number, cy: number, r: number, fill: string): SpriteShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx: r,
  ry: r,
  fill,
  stroke: INK,
  sw: 3,
})

const CAP = 'M31 36 C29 20 40 12 52 12 C66 12 73 22 69 38 C64 28 56 24 46 26 C40 28 34 32 31 36 Z'

export const HAIR_STYLES: Record<string, (c: string) => HairLayers> = {
  longStraight: (c) => ({
    back: [path('M26 50 C22 16 38 8 50 8 C62 8 78 16 74 50 L77 84 C70 88 62 86 58 82 L42 82 C38 86 30 88 23 84 Z', c)],
    front: [path('M30 38 C30 20 42 13 52 13 C64 13 72 22 70 38 C64 28 56 24 46 26 C40 28 34 32 30 38 Z', c)],
    ears: false,
  }),
  longWavy: (c) => ({
    back: [
      path(
        'M26 50 C20 16 38 8 50 8 C62 8 80 16 74 50 C80 60 76 70 80 78 C76 86 70 80 66 86 C62 80 58 86 54 80 L46 80 C42 86 38 80 34 86 C30 80 24 86 20 78 C24 70 20 60 26 50 Z',
        c,
      ),
    ],
    front: [path('M30 38 C30 20 42 13 52 13 C64 13 72 22 70 38 C64 28 56 24 46 26 C40 28 34 32 30 38 Z', c)],
    ears: false,
  }),
  bob: (c) => ({
    back: [path('M25 46 C22 14 38 9 50 9 C62 9 78 14 75 46 L75 64 C68 68 62 62 60 58 L40 58 C38 62 32 68 25 64 Z', c)],
    front: [path('M30 36 C30 20 41 14 50 14 C62 14 71 20 70 36 C62 30 38 30 30 36 Z', c)],
    ears: false,
  }),
  curls: (c) => ({
    back: [
      blob(26, 40, 10, c), blob(74, 40, 10, c), blob(28, 58, 9, c), blob(72, 58, 9, c),
      blob(34, 24, 10, c), blob(66, 24, 10, c), blob(50, 17, 11, c),
    ],
    front: [blob(40, 24, 8, c), blob(52, 20, 8, c), blob(62, 26, 7, c)],
    ears: false,
  }),
  bun: (c) => ({
    back: [blob(50, 9, 10, c)],
    front: [path(CAP, c)],
    ears: true,
  }),
  ponytail: (c) => ({
    back: [path('M68 28 C86 26 92 48 84 66 C80 74 72 70 76 58 C78 48 74 38 66 34 Z', c)],
    front: [path(CAP, c)],
    ears: true,
  }),
  pixie: (c) => ({
    back: [],
    front: [path('M31 40 C27 18 42 9 54 10 C68 11 75 22 70 38 C66 26 56 22 44 26 C36 29 32 32 31 40 Z', c)],
    ears: true,
  }),
  puff: (c) => ({
    back: [{ kind: 'ellipse', cx: 50, cy: 26, rx: 28, ry: 24, fill: c, stroke: INK, sw: 3 }],
    front: [path('M32 38 C32 28 40 24 50 24 C60 24 68 28 68 38 C62 32 38 32 32 38 Z', c)],
    ears: true,
  }),
  short: (c) => ({ back: [], front: [path(CAP, c)], ears: true }),
  sidePart: (c) => ({
    back: [],
    front: [
      path('M31 38 C28 18 44 10 56 12 C68 14 72 26 69 38 C62 24 50 22 40 28 C36 31 33 34 31 38 Z', c),
      path('M44 26 C48 18 54 14 58 13', c, 2),
    ],
    ears: true,
  }),
  buzz: (c) => ({
    back: [],
    front: [path('M32 34 C30 21 40 16 50 16 C60 16 70 21 68 34 C60 25 40 25 32 34 Z', c, 2)],
    ears: true,
  }),
  curlyTop: (c) => ({
    back: [],
    front: [blob(36, 24, 8, c), blob(46, 17, 9, c), blob(58, 17, 9, c), blob(67, 25, 8, c), blob(51, 24, 8, c)],
    ears: true,
  }),
  receding: (c) => ({
    back: [],
    front: [
      path('M31 42 C28 30 32 22 39 19 C37 28 37 35 39 42 Z', c),
      path('M69 42 C72 30 68 22 61 19 C63 28 63 35 61 42 Z', c),
      path('M39 19 C46 12 56 12 61 19 C56 16 44 16 39 19 Z', c),
    ],
    ears: true,
  }),
  bald: () => ({ back: [], front: [], ears: true }),
  quiff: (c) => ({
    back: [],
    front: [
      path('M31 38 C26 18 38 6 54 8 C70 10 76 24 69 38 C66 26 56 20 46 24 C38 27 33 32 31 38 Z', c),
      path('M40 22 C46 12 56 10 64 14', c, 2),
    ],
    ears: true,
  }),
  slick: (c) => ({
    back: [],
    front: [path('M31 38 C29 22 40 14 52 14 C66 14 73 24 69 38 C66 30 56 26 50 26 C42 26 34 30 31 38 Z', c), path('M38 22 C46 18 56 18 64 22', c, 2)],
    ears: true,
  }),
}

export const STYLE_POOLS: Record<Pronoun, readonly string[]> = {
  she: ['longStraight', 'longWavy', 'bob', 'curls', 'bun', 'ponytail', 'pixie', 'puff'],
  he: ['short', 'sidePart', 'buzz', 'curlyTop', 'receding', 'bald', 'quiff', 'slick'],
  they: ['longStraight', 'bob', 'curls', 'bun', 'pixie', 'puff', 'short', 'sidePart', 'buzz', 'curlyTop', 'quiff', 'slick'],
}

export function facialHair(kind: string, c: string): SpriteShape[] {
  const mustache = path('M39 53 C43 49 48 50 50 53 C52 50 57 49 61 53 C57 57 43 57 39 53 Z', c, 2)
  switch (kind) {
    case 'stubble':
      return [{ kind: 'path', d: 'M32 46 C33 70 67 70 68 46 C62 60 38 60 32 46 Z', fill: c, stroke: 'none', sw: 0 }]
    case 'moustache':
      return [mustache]
    case 'goatee':
      return [mustache, path('M44 60 C46 68 54 68 56 60 C54 63 46 63 44 60 Z', c, 2)]
    case 'fullBeard':
      return [path('M31 44 C30 72 70 72 69 44 C66 58 56 60 50 60 C44 60 34 58 31 44 Z', c), mustache]
    default:
      return []
  }
}

export const FACIAL_HAIR_POOLS: Record<Pronoun, readonly string[]> = {
  she: ['none'],
  he: ['none', 'none', 'stubble', 'moustache', 'goatee', 'fullBeard'],
  they: ['none', 'none', 'none', 'stubble'],
}
