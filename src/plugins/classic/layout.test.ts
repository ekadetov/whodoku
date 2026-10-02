import { describe, expect, it } from 'vitest'
import { generateLayout } from './layout'
import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { mulberry32 } from '../../engine/rng'
import type { Cell } from '../../engine/types'

function isConnected(cells: Cell[][], room: number): boolean {
  const size = cells.length
  const members: string[] = []
  cells.forEach((row, r) => row.forEach((cell, c) => cell.room === room && members.push(`${r},${c}`)))
  if (members.length === 0) return false
  const seen = new Set<string>([members[0]])
  const queue = [members[0]]
  while (queue.length > 0) {
    const [r, c] = queue.shift()!.split(',').map(Number)
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr
      const nc = c + dc
      const key = `${nr},${nc}`
      if (nr >= 0 && nc >= 0 && nr < size && nc < size && cells[nr][nc].room === room && !seen.has(key)) {
        seen.add(key)
        queue.push(key)
      }
    }
  }
  return seen.size === members.length
}

describe('generateLayout', () => {
  it.each([6, 8, 10])('builds connected rooms covering a %i x %i grid', (size) => {
    for (let seed = 1; seed <= 20; seed++) {
      const layout = generateLayout(mulberry32(seed), size, size)
      expect(layout.cells).toHaveLength(size)
      expect(layout.rooms).toHaveLength(size)
      expect(new Set(layout.rooms).size).toBe(size)
      for (const row of layout.cells) {
        expect(row).toHaveLength(size)
        for (const cell of row) {
          expect(cell.room).toBeGreaterThanOrEqual(0)
          expect(cell.room).toBeLessThan(size)
        }
      }
      for (let room = 0; room < size; room++) expect(isConnected(layout.cells, room)).toBe(true)
    }
  })

  it('places a mix of objects', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 10; seed++) {
      for (const row of generateLayout(mulberry32(seed), 8, 8).cells) {
        for (const cell of row) if (cell.object) kinds.add(cell.object)
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(6)
  })

  it('is deterministic for a given seed', () => {
    expect(generateLayout(mulberry32(5), 8, 8)).toEqual(generateLayout(mulberry32(5), 8, 8))
  })

  it('draws rooms and objects from the given theme', () => {
    const theme: ThemeDef = {
      id: 'mini',
      rooms: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
      suspects: ['S'],
      objects: {
        chair: { noun: 'a chair', standingOn: 'on a chair', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.5 },
        table: { noun: 'a table', standingOn: 'on a table', sprite: { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }, weight: 0.4 },
      },
    }
    const layout = generateLayout(mulberry32(3), 6, 6, theme)
    expect(layout.rooms.every((room) => theme.rooms.includes(room))).toBe(true)
    const kinds = new Set(layout.cells.flat().map((cell) => cell.object))
    expect([...kinds].every((kind) => kind === null || kind === 'chair' || kind === 'table')).toBe(true)
    expect(kinds.has('chair') && kinds.has('table')).toBe(true)
  })

  it('refuses a theme with too few rooms', () => {
    const theme: ThemeDef = { ...registry.theme(), id: 'tiny', rooms: ['Only'] }
    expect(() => generateLayout(mulberry32(1), 6, 6, theme)).toThrow('fewer than 6 rooms')
  })
})
