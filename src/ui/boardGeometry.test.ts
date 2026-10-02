import { describe, expect, it } from 'vitest'
import { cellAt, lineCells } from './boardGeometry'

const rect = { left: 100, top: 50, width: 400, height: 400 }

describe('cellAt', () => {
  it('maps a point to the cell under it', () => {
    expect(cellAt(rect, 4, 101, 51)).toEqual({ r: 0, c: 0 })
    expect(cellAt(rect, 4, 499, 449)).toEqual({ r: 3, c: 3 })
    expect(cellAt(rect, 4, 250, 160)).toEqual({ r: 1, c: 1 })
  })

  it('returns null outside the board', () => {
    expect(cellAt(rect, 4, 99, 100)).toBeNull()
    expect(cellAt(rect, 4, 200, 49)).toBeNull()
    expect(cellAt(rect, 4, 500, 100)).toBeNull()
    expect(cellAt(rect, 4, 200, 450)).toBeNull()
  })
})

describe('lineCells', () => {
  it('returns just the cell when both ends match', () => {
    expect(lineCells({ r: 2, c: 2 }, { r: 2, c: 2 })).toEqual([{ r: 2, c: 2 }])
  })

  it('walks a row in order, in both directions', () => {
    expect(lineCells({ r: 1, c: 0 }, { r: 1, c: 3 }).map((p) => p.c)).toEqual([0, 1, 2, 3])
    expect(lineCells({ r: 1, c: 3 }, { r: 1, c: 0 }).map((p) => p.c)).toEqual([3, 2, 1, 0])
  })

  it('walks a diagonal without gaps', () => {
    expect(lineCells({ r: 0, c: 0 }, { r: 3, c: 3 })).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 1 },
      { r: 2, c: 2 },
      { r: 3, c: 3 },
    ])
  })

  it('never skips a row or column on a shallow line', () => {
    const cells = lineCells({ r: 0, c: 0 }, { r: 2, c: 7 })
    expect(cells[0]).toEqual({ r: 0, c: 0 })
    expect(cells[cells.length - 1]).toEqual({ r: 2, c: 7 })
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i].r - cells[i - 1].r)).toBeLessThanOrEqual(1)
      expect(Math.abs(cells[i].c - cells[i - 1].c)).toBeLessThanOrEqual(1)
    }
  })
})
