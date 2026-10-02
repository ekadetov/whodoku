import type { Pos, Puzzle } from '../engine/types'
import { suspectColor } from './glyphs'

interface SuspectTrayProps {
  puzzle: Puzzle
  placements: Record<number, Pos>
  selected: number | null
  onSelect: (suspect: number | null) => void
}

export function SuspectTray({ puzzle, placements, selected, onSelect }: SuspectTrayProps) {
  return (
    <div className="tray" aria-label="Suspects">
      {puzzle.suspects.map((suspect, i) => (
        <button
          key={suspect.name}
          type="button"
          data-testid={`suspect-${i}`}
          className={`tray-item${selected === i ? ' selected' : ''}${placements[i] ? ' placed' : ''}`}
          aria-pressed={selected === i}
          onClick={() => onSelect(selected === i ? null : i)}
        >
          <span className="chip" style={{ background: suspectColor(i) }}>
            {suspect.name[0]}
          </span>
          {suspect.name}
          {i === puzzle.victim && <small> (victim)</small>}
        </button>
      ))}
    </div>
  )
}
