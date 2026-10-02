import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { renderClue } from '../engine/clues'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { portraitFor } from './art/portrait'
import { Sprite } from './art/Sprite'
import { cellAt } from './boardGeometry'

interface SuspectPanelProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  selected: number | null
  struck: readonly number[]
  failing: ReadonlySet<number>
  boardRef: RefObject<HTMLDivElement | null>
  onSelect: (suspect: number | null) => void
  onToggleStrike: (suspect: number) => void
  onDrop: (suspect: number, pos: Pos) => void
}

interface Ghost {
  suspect: number
  x: number
  y: number
}

const DRAG_THRESHOLD = 6

export function SuspectPanel({
  puzzle,
  placements,
  selected,
  struck,
  failing,
  boardRef,
  onSelect,
  onToggleStrike,
  onDrop,
}: SuspectPanelProps) {
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragged = useRef(false)
  const stopDrag = useRef<(() => void) | null>(null)

  useEffect(() => () => stopDrag.current?.(), [])

  const beginDrag = (e: PointerEvent<HTMLElement>, suspect: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopDrag.current?.()
    const origin = { x: e.clientX, y: e.clientY }
    dragged.current = false

    const move = (ev: globalThis.PointerEvent) => {
      if (!dragged.current && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD) return
      dragged.current = true
      setGhost({ suspect, x: ev.clientX, y: ev.clientY })
    }
    const end = (ev: globalThis.PointerEvent) => {
      stop()
      if (!dragged.current || ev.type === 'pointercancel') return
      const box = boardRef.current?.getBoundingClientRect()
      const pos = box && cellAt(box, puzzle.size, ev.clientX, ev.clientY)
      if (pos && isOccupiable(puzzle.cells[pos.r][pos.c])) onDrop(suspect, pos)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      stopDrag.current = null
      setGhost(null)
    }
    stopDrag.current = stop
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <>
      <ul className="suspects" aria-label="Suspects">
        {puzzle.suspects.map((suspect, i) => (
          <li
            key={suspect.name}
            className={`card${placements[i] ? ' placed' : ''}${i === puzzle.victim ? ' victim' : ''}`}
          >
            <button
              type="button"
              data-testid={`suspect-${i}`}
              className="portrait-card"
              aria-pressed={selected === i}
              onPointerDown={(e) => beginDrag(e, i)}
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false
                  return
                }
                onSelect(selected === i ? null : i)
              }}
            >
              <span className="portrait">
                <Sprite sprite={portraitFor(suspect.name)} />
              </span>
              <span className="plate">
                {suspect.name}
                {i === puzzle.victim && <small> (victim)</small>}
              </span>
            </button>
            <button
              type="button"
              data-testid={`clue-${i}`}
              className={`clue-card${struck.includes(i) ? ' struck' : ''}${failing.has(i) ? ' failing' : ''}`}
              aria-pressed={struck.includes(i)}
              title="Click to cross out this clue"
              onClick={() => onToggleStrike(i)}
            >
              {puzzle.clues
                .filter((clue) => clue.suspect === i)
                .map((clue) => renderClue(clue, puzzle))
                .join(' ')}
            </button>
          </li>
        ))}
      </ul>
      {ghost && (
        <div className="ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <Sprite sprite={portraitFor(puzzle.suspects[ghost.suspect].name)} />
        </div>
      )}
    </>
  )
}
