import type { SpriteDef, SpriteShape } from '../../engine/plugin'

const INK = '#1f2430'

const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, stroke = INK, sw = 3): SpriteShape => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  rx,
  fill,
  stroke,
  sw,
})

const path = (d: string, fill: string, stroke = INK, sw = 3): SpriteShape => ({ kind: 'path', d, fill, stroke, sw })

const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, stroke = 'none', sw = 0): SpriteShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
  fill,
  stroke,
  sw,
})

const BOOKS = ['#e85d75', '#f2c14e', '#58b09c', '#7aa6e0']
const books = (y: number, h: number): SpriteShape[] =>
  [24, 34, 44, 54, 64].map((x, i) => rect(x, y, 8, h, BOOKS[i % BOOKS.length], 1, INK, 1.5))

export const SPRITES: Record<string, SpriteDef> = {
  chair: {
    shapes: [
      rect(8, 40, 18, 44, '#cfdde9', 9),
      rect(74, 40, 18, 44, '#cfdde9', 9),
      rect(16, 44, 68, 38, '#dfe9f1', 12),
      rect(20, 12, 60, 44, '#eef3f7', 14),
      rect(28, 50, 44, 26, '#f6f9fb', 8, INK, 2),
    ],
  },
  rug: {
    shapes: [rect(6, 6, 88, 88, '#c9a6d4', 6), rect(16, 16, 68, 68, '#e1c9e8', 3, '#8e6aa0', 2)],
  },
  water: {
    shapes: [
      rect(4, 4, 92, 92, '#8fc8f0', 8),
      path('M10 38 Q22 26 34 38 T58 38 T82 38', 'none', '#ffffff', 4),
      path('M18 62 Q30 50 42 62 T66 62 T90 62', 'none', '#ffffff', 4),
    ],
  },
  table: {
    shapes: [
      rect(14, 78, 8, 12, '#c99f2e', 1),
      rect(78, 78, 8, 12, '#c99f2e', 1),
      rect(10, 22, 80, 58, '#f6d776', 6),
      rect(17, 29, 66, 44, 'none', 4, '#d9b74a', 2),
    ],
  },
  shelf: {
    shapes: [
      rect(14, 8, 72, 84, '#6b5b95', 4),
      rect(20, 14, 60, 24, '#3b3363', 1, INK, 1.5),
      rect(20, 42, 60, 24, '#3b3363', 1, INK, 1.5),
      rect(20, 70, 60, 16, '#3b3363', 1, INK, 1.5),
      ...books(16, 20),
      ...books(44, 20),
    ],
  },
  plant: {
    shapes: [
      path('M50 62 C30 50 24 30 34 10 C46 24 52 44 50 62 Z', '#4fbf8f'),
      path('M50 62 C70 50 76 30 66 10 C54 24 48 44 50 62 Z', '#4fbf8f'),
      path('M50 62 C42 44 44 24 50 6 C56 24 58 44 50 62 Z', '#3aa578'),
      path('M30 60 L70 60 L63 92 L37 92 Z', '#8a5cc2'),
    ],
  },
  rock: {
    shapes: [
      path('M14 78 C10 56 24 34 46 30 C70 26 90 44 88 70 C87 82 78 88 64 88 L28 88 C20 88 15 84 14 78 Z', '#7aa0ad'),
      ellipse(40, 50, 12, 7, '#a4c3cd'),
    ],
  },
  tree: {
    shapes: [
      rect(44, 72, 12, 20, '#8a5a3a', 1),
      path('M50 40 L90 82 L10 82 Z', '#3f9e6b'),
      path('M50 22 L84 60 L16 60 Z', '#4fb87a'),
      path('M50 6 L76 38 L24 38 Z', '#5cc98a'),
    ],
  },
  tv: {
    shapes: [
      rect(8, 18, 84, 54, '#2b2f3a', 6),
      rect(14, 24, 72, 42, '#6fb8e8', 3, INK, 2),
      path('M20 30 L44 30 L28 60 L20 60 Z', '#a9d8f3', 'none', 0),
      rect(38, 72, 24, 8, '#2b2f3a', 0),
      rect(28, 80, 44, 8, '#2b2f3a', 3),
    ],
  },
}
