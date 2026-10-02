import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { PaintMode, ToolDef } from '../engine/plugin'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { posKey } from '../state/reducer'
import { labelFor, spriteFor } from './art/lookup'
import { bustFor, portraitColor } from './art/portrait'
import { Sprite } from './art/Sprite'
import { roomSurface } from './art/texture'
import { cellAt, lineCells } from './boardGeometry'
import { NO_HIGHLIGHT } from './highlight'
import type { Highlight } from './highlight'

interface BoardProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  marks: ReadonlySet<string>
  selected: number | null
  notes: Readonly<Record<string, readonly number[]>>
  verdict?: ReadonlyMap<number, boolean>
  conflicts: ReadonlySet<string>
  tool: ToolDef | undefined
  highlight?: Highlight
  selectedClue?: string | null
  gridRef?: RefObject<HTMLDivElement | null>
  onCellClick: (pos: Pos) => void
  onHold: (pos: Pos) => void
  onStroke: (cells: Pos[], mode: PaintMode) => void
}

interface Stroke {
  mode: PaintMode
  cells: Pos[]
}

const HOLD_MS = 600
const RING_DELAY_MS = 160

const THICK = 'var(--wall-thick)'
const THIN = 'var(--wall-thin)'

const EDGE = '4px'

/** Inset shadows along the sides of a cell that touch another room, for outlining a room. */
function roomEdges(puzzle: Puzzle, r: number, c: number): string {
  const room = puzzle.cells[r][c].room
  const outside = (nr: number, nc: number) => puzzle.cells[nr]?.[nc]?.room !== room
  return [
    outside(r - 1, c) ? `inset 0 ${EDGE} 0 0 var(--hint)` : '',
    outside(r, c + 1) ? `inset -${EDGE} 0 0 0 var(--hint)` : '',
    outside(r + 1, c) ? `inset 0 -${EDGE} 0 0 var(--hint)` : '',
    outside(r, c - 1) ? `inset ${EDGE} 0 0 0 var(--hint)` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

export function Board({
  puzzle,
  placements,
  marks,
  selected,
  notes,
  verdict,
  conflicts,
  tool,
  highlight = NO_HIGHLIGHT,
  selectedClue = null,
  gridRef,
  onCellClick,
  onHold,
  onStroke,
}: BoardProps) {
  const strokeRef = useRef<Stroke | null>(null)
  const [preview, setPreview] = useState<Stroke | null>(null)
  const [hovered, setHovered] = useState<Pos | null>(null)
  const [ringAt, setRingAt] = useState<string | null>(null)
  const hold = useRef<{ ring: ReturnType<typeof setTimeout>; fire: ReturnType<typeof setTimeout> } | null>(null)
  const swallowClick = useRef(false)
  const paint = tool?.paint
  const colors = useMemo(() => puzzle.suspects.map(portraitColor), [puzzle.suspects])

  const cancelHold = () => {
    if (hold.current) {
      clearTimeout(hold.current.ring)
      clearTimeout(hold.current.fire)
      hold.current = null
    }
    setRingAt(null)
  }
  useEffect(() => cancelHold, [])

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

  const allowed = (pos: Pos) =>
    isOccupiable(puzzle.cells[pos.r][pos.c]) && !marks.has(posKey(pos)) && !occupantAt.has(posKey(pos))

  const startHold = (pos: Pos) => (e: PointerEvent<HTMLButtonElement>) => {
    swallowClick.current = false
    if (paint || selected === null || !allowed(pos) || (e.pointerType === 'mouse' && e.button !== 0)) return
    cancelHold()
    const key = posKey(pos)
    hold.current = {
      ring: setTimeout(() => setRingAt(key), RING_DELAY_MS),
      fire: setTimeout(() => {
        swallowClick.current = true
        cancelHold()
        onHold(pos)
      }, HOLD_MS),
    }
  }

  const previewing = new Set(preview?.cells.map(posKey))
  const hoveredRoom = hovered ? puzzle.cells[hovered.r][hovered.c].room : null
  const hover = (pos: Pos | null) => (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch') setHovered(pos)
  }

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
          const isHovered = hovered !== null && hovered.r === r && hovered.c === c
          const outlined = highlight.rooms.has(cell.room) || hoveredRoom === cell.room
          const classes = [
            'cell',
            highlight.cells.has(key) ? 'hint' : '',
            isHovered ? 'hovered' : '',
            outlined ? 'outlined' : '',
            conflicts.has(key) ? 'conflict' : '',
            selected !== null && occupant === selected ? 'picked' : '',
            selected !== null && blocked ? 'unavailable' : '',
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
              onPointerEnter={hover(pos)}
              onPointerLeave={(e) => {
                cancelHold()
                hover(null)(e)
              }}
              onPointerDown={startHold(pos)}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => selected !== null && e.preventDefault()}
              style={{
                ...roomSurface(cell.room),
                ...(outlined ? { ['--edge-shadow' as string]: roomEdges(puzzle, r, c) } : {}),
                borderTop: differs(r - 1, c) ? THICK : THIN,
                borderBottom: differs(r + 1, c) ? THICK : THIN,
                borderLeft: differs(r, c - 1) ? THICK : THIN,
                borderRight: differs(r, c + 1) ? THICK : THIN,
              }}
              onClick={(e) => {
                if (swallowClick.current) {
                  swallowClick.current = false
                  return
                }
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
              {isHovered && (
                <>
                  <span className="tip">{cell.object ? labelFor(puzzle, cell.object) : puzzle.rooms[cell.room]}</span>
                  {selectedClue && <span className="tip clue">{selectedClue}</span>}
                </>
              )}
              {occupant === undefined && notes[key] && (
                <span className="notes">
                  {notes[key].map((suspect) => (
                    <span key={suspect} className="note" style={{ color: colors[suspect] }}>
                      {puzzle.suspects[suspect].name[0]}
                    </span>
                  ))}
                </span>
              )}
              {ringAt === key && selected !== null && (
                <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="ring-outline" cx="50" cy="50" r="39.5" pathLength="100" transform="rotate(-90 50 50)" />
                  <circle
                    className="ring-fill"
                    cx="50"
                    cy="50"
                    r="39.5"
                    pathLength="100"
                    transform="rotate(-90 50 50)"
                    style={{ stroke: colors[selected] }}
                  />
                </svg>
              )}
              {occupant !== undefined && (
                <span
                  className={[
                    'token',
                    highlight.suspects.has(occupant) ? 'linked' : '',
                    verdict?.has(occupant) ? (verdict.get(occupant) ? 'right' : 'wrong') : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="bust">
                    <Sprite sprite={bustFor(puzzle.suspects[occupant])} />
                  </span>
                  <span className="badge" style={{ color: colors[occupant] }}>
                    {puzzle.suspects[occupant].name[0]}
                  </span>
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
