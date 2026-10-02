import { useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { PaintMode, ToolDef } from '../engine/plugin'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { posKey } from '../state/reducer'
import { spriteFor } from './art/lookup'
import { portraitFor } from './art/portrait'
import { Sprite } from './art/Sprite'
import { roomSurface } from './art/texture'
import { cellAt, lineCells } from './boardGeometry'

interface BoardProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  marks: ReadonlySet<string>
  selected: number | null
  conflicts: ReadonlySet<string>
  tool: ToolDef | undefined
  gridRef?: RefObject<HTMLDivElement | null>
  onCellClick: (pos: Pos) => void
  onStroke: (cells: Pos[], mode: PaintMode) => void
}

interface Stroke {
  mode: PaintMode
  cells: Pos[]
}

const THICK = 'var(--wall-thick)'
const THIN = 'var(--wall-thin)'

export function Board({ puzzle, placements, marks, selected, conflicts, tool, gridRef, onCellClick, onStroke }: BoardProps) {
  const strokeRef = useRef<Stroke | null>(null)
  const [preview, setPreview] = useState<Stroke | null>(null)
  const paint = tool?.paint

  const occupantAt = new Map<string, number>()
  for (const [suspect, pos] of Object.entries(placements)) occupantAt.set(posKey(pos), Number(suspect))

  const labelAt = new Map<string, string>()
  puzzle.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const seenAbove = puzzle.cells.slice(0, r).some((above) => above.some((x) => x.room === cell.room))
      if (!seenAbove && !row.slice(0, c).some((x) => x.room === cell.room)) {
        labelAt.set(posKey({ r, c }), puzzle.rooms[cell.room])
      }
    }),
  )

  const modeAt = (pos: Pos): PaintMode | null => {
    const key = posKey(pos)
    return paint ? paint({ marked: marks.has(key), occupied: occupantAt.has(key) }) : null
  }

  const setStroke = (next: Stroke | null) => {
    strokeRef.current = next
    setPreview(next)
  }

  const locate = (e: PointerEvent<HTMLDivElement>) =>
    cellAt(e.currentTarget.getBoundingClientRect(), puzzle.size, e.clientX, e.clientY)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!paint || (e.pointerType === 'mouse' && e.button !== 0)) return
    const pos = locate(e)
    const mode = pos && modeAt(pos)
    if (!pos || !mode) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setStroke({ mode, cells: [pos] })
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current
    const pos = stroke && locate(e)
    if (!stroke || !pos) return
    const last = stroke.cells[stroke.cells.length - 1]
    if (pos.r === last.r && pos.c === last.c) return
    const fresh = lineCells(last, pos)
      .slice(1)
      .filter((p) => !stroke.cells.some((q) => q.r === p.r && q.c === p.c))
    if (fresh.length > 0) setStroke({ ...stroke, cells: [...stroke.cells, ...fresh] })
  }

  const onPointerUp = () => {
    const stroke = strokeRef.current
    setStroke(null)
    if (!stroke) return
    const cells = stroke.cells.filter((p) => isOccupiable(puzzle.cells[p.r][p.c]))
    if (cells.length > 0) onStroke(cells, stroke.mode)
  }

  const previewing = new Set(preview?.cells.map(posKey))

  return (
    <div
      ref={gridRef}
      className={`board${paint ? ' stroking' : ''}`}
      style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      role="grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setStroke(null)}
    >
      {puzzle.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const pos = { r, c }
          const key = posKey(pos)
          const occupant = occupantAt.get(key)
          const differs = (nr: number, nc: number) => puzzle.cells[nr]?.[nc]?.room !== cell.room
          const blocked = !isOccupiable(cell)
          const marked = marks.has(key) && occupant === undefined
          const occupantName = occupant === undefined ? '' : `, ${puzzle.suspects[occupant].name}`
          const label = `Row ${r + 1}, column ${c + 1}, ${puzzle.rooms[cell.room]}${cell.object ? `, ${cell.object}` : ''}${occupantName}`
          const classes = [
            'cell',
            conflicts.has(key) ? 'conflict' : '',
            selected !== null && occupant === selected ? 'picked' : '',
            previewing.has(key) && preview ? `stroke-${preview.mode}` : '',
          ]
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-testid={`cell-${r}-${c}`}
              data-occupant={occupant}
              data-marked={marked ? 'true' : undefined}
              aria-label={label}
              aria-disabled={blocked || undefined}
              className={classes.filter(Boolean).join(' ')}
              style={{
                ...roomSurface(cell.room),
                borderTop: differs(r - 1, c) ? THICK : THIN,
                borderBottom: differs(r + 1, c) ? THICK : THIN,
                borderLeft: differs(r, c - 1) ? THICK : THIN,
                borderRight: differs(r, c + 1) ? THICK : THIN,
              }}
              onClick={(e) => {
                if (blocked) return
                if (!paint) return onCellClick(pos)
                const mode = e.detail === 0 ? modeAt(pos) : null
                if (mode) onStroke([pos], mode)
              }}
            >
              {labelAt.has(key) && (
                <span className={`room-label${c >= puzzle.size - 2 ? ' end' : ''}`}>{labelAt.get(key)}</span>
              )}
              {cell.object && <Sprite sprite={spriteFor(puzzle, cell.object)} className="sprite" />}
              {marked && (
                <svg className="mark" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M22 22L78 78M78 22L22 78" />
                </svg>
              )}
              {occupant !== undefined && (
                <span className="token">
                  <Sprite sprite={portraitFor(puzzle.suspects[occupant].name)} />
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
