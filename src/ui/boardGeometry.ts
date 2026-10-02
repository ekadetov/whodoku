import type { Pos } from '../engine/types'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export function cellAt(box: Box, size: number, x: number, y: number): Pos | null {
  const c = Math.floor(((x - box.left) / box.width) * size)
  const r = Math.floor(((y - box.top) / box.height) * size)
  return r >= 0 && c >= 0 && r < size && c < size ? { r, c } : null
}

/** Every cell on the straight line from `from` to `to`, both ends included (Bresenham). */
export function lineCells(from: Pos, to: Pos): Pos[] {
  const cells: Pos[] = []
  const dr = Math.abs(to.r - from.r)
  const dc = Math.abs(to.c - from.c)
  const stepR = from.r < to.r ? 1 : -1
  const stepC = from.c < to.c ? 1 : -1
  let err = dc - dr
  let { r, c } = from
  for (;;) {
    cells.push({ r, c })
    if (r === to.r && c === to.c) return cells
    const doubled = 2 * err
    if (doubled > -dr) {
      err -= dr
      c += stepC
    }
    if (doubled < dc) {
      err += dc
      r += stepR
    }
  }
}
