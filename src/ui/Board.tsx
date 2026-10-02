import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { posKey } from '../state/reducer'
import { Sprite } from './art/Sprite'
import { spriteFor } from './art/lookup'
import { roomHue, suspectColor } from './palette'

interface BoardProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  marks: ReadonlySet<string>
  selected: number | null
  conflicts: ReadonlySet<string>
  onCellClick: (pos: Pos) => void
}

const EDGE = '3px solid #1f2430'
const SOFT = '1px solid rgba(0,0,0,0.18)'

export function Board({ puzzle, placements, marks, selected, conflicts, onCellClick }: BoardProps) {
  const occupantAt = new Map<string, number>()
  for (const [suspect, pos] of Object.entries(placements)) occupantAt.set(posKey(pos), Number(suspect))

  const labelAt = new Map<string, string>()
  puzzle.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!puzzle.cells.slice(0, r).some((above) => above.some((x) => x.room === cell.room)) && !row.slice(0, c).some((x) => x.room === cell.room)) {
        labelAt.set(posKey({ r, c }), puzzle.rooms[cell.room])
      }
    }),
  )

  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }} role="grid">
      {puzzle.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const pos = { r, c }
          const key = posKey(pos)
          const occupant = occupantAt.get(key)
          const differs = (nr: number, nc: number) => puzzle.cells[nr]?.[nc]?.room !== cell.room
          const blocked = !isOccupiable(cell)
          const hue = roomHue(cell.room)
          const label = `Row ${r + 1}, column ${c + 1}, ${puzzle.rooms[cell.room]}${cell.object ? `, ${cell.object}` : ''}`
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-testid={`cell-${r}-${c}`}
              aria-label={label}
              disabled={blocked}
              className={`cell${conflicts.has(key) ? ' conflict' : ''}${selected !== null && occupant === selected ? ' picked' : ''}`}
              style={{
                background: blocked ? `hsl(${hue} 12% 62%)` : `hsl(${hue} 55% 89%)`,
                borderTop: differs(r - 1, c) ? EDGE : SOFT,
                borderBottom: differs(r + 1, c) ? EDGE : SOFT,
                borderLeft: differs(r, c - 1) ? EDGE : SOFT,
                borderRight: differs(r, c + 1) ? EDGE : SOFT,
              }}
              onClick={() => onCellClick(pos)}
            >
              {labelAt.has(key) && <span className="room-label">{labelAt.get(key)}</span>}
              {cell.object && <Sprite sprite={spriteFor(puzzle, cell.object)} className="sprite" />}
              {marks.has(key) && occupant === undefined && <span className="mark">x</span>}
              {occupant !== undefined && (
                <span className="chip" style={{ background: suspectColor(occupant) }}>
                  {puzzle.suspects[occupant].name[0]}
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
