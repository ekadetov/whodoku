import type { SpriteDef, SpriteShape } from '../../../engine/plugin'
import { hashSeed, mulberry32, pick } from '../../../engine/rng'
import type { Suspect } from '../../../engine/types'
import { FACIAL_HAIR_POOLS, HAIR_STYLES, STYLE_POOLS, facialHair } from './hair'
import { BACKGROUNDS, HAIRS, INK, SHIRTS, SKINS } from './palette'

const SHOULDERS = {
  she: 'M12 100 C12 82 26 74 44 72 L56 72 C74 74 88 82 88 100 Z',
  he: 'M4 100 C4 80 22 72 42 70 L58 70 C78 72 96 80 96 100 Z',
  they: 'M8 100 C8 81 24 73 43 71 L57 71 C76 73 92 81 92 100 Z',
} as const

const FACES = {
  round: 'M31 40 C31 24 40 18 50 18 C60 18 69 24 69 40 C69 56 60 66 50 66 C40 66 31 56 31 40 Z',
  oval: 'M32 38 C32 22 41 16 50 16 C59 16 68 22 68 38 C68 54 60 67 50 67 C40 67 32 54 32 38 Z',
  square: 'M31 34 C31 22 40 18 50 18 C60 18 69 22 69 34 L69 50 C69 60 60 66 50 66 C40 66 31 60 31 50 Z',
} as const

const FACE_POOLS = { she: ['round', 'oval'], he: ['square', 'oval', 'square'], they: ['round', 'oval', 'square'] } as const
const SHIRT_KINDS = ['tee', 'collared', 'plaid', 'hoodie', 'blouse'] as const
const SHIRT_POOLS = {
  she: ['tee', 'blouse', 'collared', 'hoodie'],
  he: ['tee', 'collared', 'plaid', 'hoodie'],
  they: ['tee', 'collared', 'plaid', 'hoodie', 'blouse'],
} as const

const shade = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.max(0, Math.round(v * 0.78))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`
}

const path = (d: string, fill: string, stroke = INK, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke, sw })

function clothing(kind: string, shirt: string, skin: string): SpriteShape[] {
  const dark = shade(shirt)
  switch (kind) {
    case 'collared':
      return [
        path('M42 71 L50 86 L58 71 Z', skin, INK, 2),
        path('M39 69 L50 86 L35 83 Z', '#f4f1ea', INK, 2),
        path('M61 69 L50 86 L65 83 Z', '#f4f1ea', INK, 2),
      ]
    case 'plaid':
      return [
        { kind: 'path', d: 'M20 86 H80 M18 94 H82 M30 80 V100 M44 80 V100 M58 80 V100 M72 80 V100', fill: 'none', stroke: dark, sw: 2 },
        path('M41 71 Q50 80 59 71 Z', skin, INK, 2),
      ]
    case 'hoodie':
      return [
        path('M30 70 Q50 56 70 70 L72 80 Q50 90 28 80 Z', dark),
        path('M45 82 L44 94 M55 82 L56 94', 'none', INK, 2),
      ]
    case 'blouse':
      return [path('M42 71 L50 82 L58 71 Z', skin, INK, 2), path('M50 80 L42 75 L43 85 Z', shirt, INK, 2), path('M50 80 L58 75 L57 85 Z', shirt, INK, 2)]
    default:
      return [path('M41 71 Q50 82 59 71 Z', skin, INK, 2)]
  }
}

export interface PortraitChoices {
  background: string
  skin: string
  hairColor: string
  shirt: string
  hairStyle: string
  facialHair: string
  face: keyof typeof FACES
  shirtKind: (typeof SHIRT_KINDS)[number]
  glasses: boolean
  earrings: boolean
}

/** Everything the portrait varies on: pinned by `suspect.look` where given, otherwise drawn from pools that match the pronoun. */
export function portraitChoices({ name, pronoun, look = {} }: Suspect): PortraitChoices {
  const rng = mulberry32(hashSeed(`portrait:${name}`))
  const background = pick(rng, BACKGROUNDS)
  const skin = pick(rng, SKINS)
  const hairColor = pick(rng, HAIRS)
  const shirt = pick(rng, SHIRTS)
  const hairStyle = pick(rng, STYLE_POOLS[pronoun])
  const facialHair = pick(rng, FACIAL_HAIR_POOLS[pronoun])
  const face = pick(rng, FACE_POOLS[pronoun])
  const shirtKind = pick(rng, SHIRT_POOLS[pronoun])
  const glasses = rng() < 0.2
  const earrings = pronoun !== 'he' && rng() < 0.4
  return {
    background,
    skin: look.skin ?? skin,
    hairColor: look.hairColor ?? hairColor,
    shirt: look.shirt ?? shirt,
    hairStyle: look.hairStyle ?? hairStyle,
    facialHair: look.facialHair ?? facialHair,
    face,
    shirtKind,
    glasses: look.glasses ?? glasses,
    earrings,
  }
}

/** A flat portrait with no facial features, in the style of the reference cards. */
export function portraitFor(suspect: Suspect): SpriteDef {
  const { pronoun } = suspect
  const c = portraitChoices(suspect)
  const { background, skin, hairColor, shirt, shirtKind, glasses, earrings } = c
  const hair = HAIR_STYLES[c.hairStyle](hairColor)
  const neckWidth = pronoun === 'he' ? 18 : pronoun === 'she' ? 12 : 14

  const shapes: SpriteShape[] = [
    { kind: 'rect', x: 0, y: 0, w: 100, h: 100, fill: background },
    path(SHOULDERS[pronoun], shirt),
    ...hair.back,
    { kind: 'rect', x: 50 - neckWidth / 2, y: 56, w: neckWidth, h: 20, fill: skin, stroke: INK, sw: 3 },
    { kind: 'rect', x: 50 - neckWidth / 2 + 1.5, y: 57, w: neckWidth - 3, h: 7, fill: 'rgba(0,0,0,0.12)', stroke: 'none', sw: 0 },
    ...clothing(shirtKind, shirt, skin),
  ]
  if (hair.ears) {
    shapes.push(
      { kind: 'ellipse', cx: 31, cy: 44, rx: 3.5, ry: 5.5, fill: skin, stroke: INK, sw: 2.5 },
      { kind: 'ellipse', cx: 69, cy: 44, rx: 3.5, ry: 5.5, fill: skin, stroke: INK, sw: 2.5 },
    )
    if (earrings) {
      shapes.push(
        { kind: 'ellipse', cx: 31, cy: 51.5, rx: 2, ry: 2, fill: '#f2c14e', stroke: INK, sw: 1 },
        { kind: 'ellipse', cx: 69, cy: 51.5, rx: 2, ry: 2, fill: '#f2c14e', stroke: INK, sw: 1 },
      )
    }
  }
  shapes.push(
    path(FACES[c.face], skin),
    { kind: 'path', d: 'M50 16 C59 16 68 22 68 38 C68 54 60 67 50 67 Z', fill: 'rgba(0,0,0,0.1)', stroke: 'none', sw: 0 },
    ...facialHair(c.facialHair, hairColor),
    ...hair.front,
  )
  if (glasses) {
    shapes.push(
      { kind: 'rect', x: 35, y: 36, w: 13, h: 10, rx: 4, fill: 'rgba(255,255,255,0.3)', stroke: INK, sw: 2 },
      { kind: 'rect', x: 52, y: 36, w: 13, h: 10, rx: 4, fill: 'rgba(255,255,255,0.3)', stroke: INK, sw: 2 },
      { kind: 'path', d: 'M48 40 H52', fill: 'none', stroke: INK, sw: 2 },
    )
  }
  return { shapes }
}
