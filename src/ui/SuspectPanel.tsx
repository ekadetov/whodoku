import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { clueParts } from '../engine/clues'
import type { ClueText } from '../engine/plugin'
import { registry } from '../engine/registry'
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
  linked: ReadonlySet<number>
  boardRef: RefObject<HTMLDivElement | null>
  onSelect: (suspect: number | null) => void
  onToggleStrike: (suspect: number) => void
  onDrop: (suspect: number, pos: Pos) => void
  onHover: (suspect: number | null) => void
}

interface Ghost {
  suspect: number
  x: number
  y: number
}

const DRAG_THRESHOLD = 6

function ClueView({ parts, subject, glossary }: { parts: ClueText[]; subject: number; glossary: Readonly<Record<string, string>> }) {
  return parts.map((part, i) => {
    if (part.kind === 'text' || (part.kind === 'person' && part.suspect === subject)) return part.text
    if (part.kind === 'relation') {
      return (
        <b key={i} className="term" data-tip={glossary[part.term]}>
          {part.text}
        </b>
      )
    }
    return <b key={i}>{part.text}</b>
  })
}

export function SuspectPanel({
  puzzle,
  placements,
  selected,
  struck,
  failing,
  linked,
  boardRef,
  onSelect,
  onToggleStrike,
  onDrop,
  onHover,
}: SuspectPanelProps) {
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragged = useRef(false)
  const stopDrag = useRef<(() => void) | null>(null)
  const pointerDriven = useRef(false)
  const glossary = registry.theme(puzzle.themeId).glossary

  useEffect(() => () => stopDrag.current?.(), [])

  // A card focused by pointer is already handled by hover and selection; only keyboard focus counts as a hint trigger.
  useEffect(() => {
    const byPointer = () => (pointerDriven.current = true)
    const byKeyboard = () => (pointerDriven.current = false)
    window.addEventListener('pointerdown', byPointer, true)
    window.addEventListener('keydown', byKeyboard, true)
    return () => {
      window.removeEventListener('pointerdown', byPointer, true)
      window.removeEventListener('keydown', byKeyboard, true)
    }
  }, [])

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
            className={`card${placements[i] ? ' placed' : ''}${i === puzzle.victim ? ' victim' : ''}${selected === i ? ' selected' : ''}${linked.has(i) ? ' linked' : ''}`}
            onPointerEnter={(e) => e.pointerType !== 'touch' && onHover(i)}
            onPointerLeave={(e) => e.pointerType !== 'touch' && onHover(null)}
            onFocus={() => !pointerDriven.current && onHover(i)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(null)
            }}
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
                <Sprite sprite={portraitFor(suspect)} />
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
                .map((clue, n) => (
                  <span key={n}>
                    {n > 0 && ' '}
                    <ClueView parts={clueParts(clue, puzzle)} subject={i} glossary={glossary} />
                  </span>
                ))}
            </button>
          </li>
        ))}
      </ul>
      {ghost && (
        <div className="ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <Sprite sprite={portraitFor(puzzle.suspects[ghost.suspect])} />
        </div>
      )}
    </>
  )
}
