import { renderClue } from '../engine/clues'
import type { Puzzle } from '../engine/types'
import { suspectColor } from './palette'

interface CluePanelProps {
  puzzle: Puzzle
  struck: readonly number[]
  failing: ReadonlySet<number>
  onToggleStrike: (suspect: number) => void
}

export function CluePanel({ puzzle, struck, failing, onToggleStrike }: CluePanelProps) {
  return (
    <ul className="clues">
      {puzzle.suspects.map((suspect, i) => (
        <li
          key={suspect.name}
          data-testid={`clue-${i}`}
          className={`clue${struck.includes(i) ? ' struck' : ''}${failing.has(i) ? ' failing' : ''}${i === puzzle.victim ? ' victim' : ''}`}
        >
          <button type="button" className="clue-button" onClick={() => onToggleStrike(i)} aria-label={`Strike ${suspect.name}'s clues`}>
            <span className="chip" style={{ background: suspectColor(i) }}>
              {suspect.name[0]}
            </span>
            <span className="clue-text">
              {puzzle.clues
                .filter((clue) => clue.suspect === i)
                .map((clue) => renderClue(clue, puzzle))
                .join(' ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
