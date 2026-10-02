import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { pick, randInt, shuffle } from '../../engine/rng'
import type { Rng } from '../../engine/rng'
import type { Cell, ObjectKind } from '../../engine/types'

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export interface Layout {
  cells: Cell[][]
  rooms: string[]
}

function growRooms(rng: Rng, size: number, roomCount: number): number[][] {
  const grid = Array.from({ length: size }, () => new Array<number>(size).fill(-1))
  shuffle(rng, Array.from({ length: size * size }, (_, i) => i))
    .slice(0, roomCount)
    .forEach((index, room) => {
      grid[Math.floor(index / size)][index % size] = room
    })

  for (let remaining = size * size - roomCount; remaining > 0; remaining--) {
    const frontier: { r: number; c: number; rooms: number[] }[] = []
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== -1) continue
        const rooms = STEPS.map(([dr, dc]) => grid[r + dr]?.[c + dc] ?? -1).filter((room) => room !== -1)
        if (rooms.length > 0) frontier.push({ r, c, rooms })
      }
    }
    const next = frontier[randInt(rng, frontier.length)]
    grid[next.r][next.c] = pick(rng, next.rooms)
  }
  return grid
}

function randomObject(rng: Rng, theme: ThemeDef): ObjectKind | null {
  let roll = rng()
  for (const [kind, { weight }] of Object.entries(theme.objects)) {
    if (roll < weight) return kind
    roll -= weight
  }
  return null
}

export function generateLayout(rng: Rng, size: number, roomCount: number, theme: ThemeDef = registry.theme()): Layout {
  if (theme.rooms.length < roomCount) throw new Error(`Theme "${theme.id}" has fewer than ${roomCount} rooms`)
  const grid = growRooms(rng, size, roomCount)
  const cells = grid.map((row) => row.map((room): Cell => ({ room, object: randomObject(rng, theme) })))
  return { cells, rooms: shuffle(rng, theme.rooms).slice(0, roomCount) }
}
