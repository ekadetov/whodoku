import type { SpriteDef, SpriteShape } from '../../engine/plugin'
import { hashSeed, mulberry32, pick } from '../../engine/rng'

const INK = '#1f2430'
const BACKGROUNDS = ['#a85d4a', '#4f8a5b', '#5aa5b0', '#5d6bb0', '#7a4f8f', '#d89a9a', '#c9a24a', '#6b7f99']
const SKINS = ['#fbd9bd', '#f2c6a0', '#e0a878', '#c68a5c', '#a8693f', '#7a4a2c']
const HAIRS = ['#2b1d16', '#5a3825', '#8a5a2b', '#d9b24c', '#b8b8c0', '#c1442e', '#1c1c24']
const SHIRTS = ['#e0872e', '#9b6bc9', '#3f7fbf', '#d95f7a', '#4fa68a', '#c9b04a', '#8a8fa8', '#d8d8e0']

const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'bald'] as const

const shape = (s: SpriteShape): SpriteShape => s

/** A faceless flat portrait, derived entirely from the name so every theme gets faces for free. */
export function portraitFor(name: string): SpriteDef {
  const rng = mulberry32(hashSeed(`portrait:${name}`))
  const background = pick(rng, BACKGROUNDS)
  const skin = pick(rng, SKINS)
  const hair = pick(rng, HAIRS)
  const shirt = pick(rng, SHIRTS)
  const style = pick(rng, HAIR_STYLES)
  const beard = style !== 'long' && rng() < 0.3

  const shapes: SpriteShape[] = [
    shape({ kind: 'rect', x: 0, y: 0, w: 100, h: 100, fill: background }),
  ]
  if (style === 'long') {
    shapes.push(
      shape({ kind: 'path', d: 'M24 56 C20 18 36 8 50 8 C64 8 80 18 76 56 L78 80 L22 80 Z', fill: hair, stroke: INK, sw: 3 }),
    )
  }
  shapes.push(
    shape({ kind: 'path', d: 'M8 100 C8 78 28 70 50 70 C72 70 92 78 92 100 Z', fill: shirt, stroke: INK, sw: 3 }),
    shape({ kind: 'rect', x: 43, y: 58, w: 14, h: 18, fill: skin, stroke: INK, sw: 3 }),
    shape({ kind: 'ellipse', cx: 50, cy: 42, rx: 20, ry: 24, fill: skin, stroke: INK, sw: 3 }),
    shape({ kind: 'path', d: 'M50 18 A20 24 0 0 1 50 66 Z', fill: 'rgba(0,0,0,0.1)' }),
  )
  if (beard) {
    shapes.push(shape({ kind: 'path', d: 'M31 46 C33 72 67 72 69 46 C62 58 38 58 31 46 Z', fill: hair, stroke: INK, sw: 3 }))
  }
  if (style === 'short' || style === 'long' || style === 'bun') {
    shapes.push(
      shape({
        kind: 'path',
        d: 'M29 38 C26 16 40 9 52 9 C66 9 75 20 71 40 C65 29 55 25 45 27 C38 29 32 33 29 38 Z',
        fill: hair,
        stroke: INK,
        sw: 3,
      }),
    )
  }
  if (style === 'bun') shapes.push(shape({ kind: 'ellipse', cx: 50, cy: 7, rx: 10, ry: 8, fill: hair, stroke: INK, sw: 3 }))
  if (style === 'curly') {
    for (const [cx, cy, r] of [[34, 22, 11], [48, 14, 12], [63, 20, 12], [72, 32, 9], [28, 34, 8]] as const) {
      shapes.push(shape({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill: hair, stroke: INK, sw: 3 }))
    }
  }
  return { shapes }
}
