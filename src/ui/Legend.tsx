import { objectKindsIn } from '../engine/candidates'
import type { Puzzle } from '../engine/types'
import { GLYPH, roomHue } from './glyphs'

export function Legend({ puzzle }: { puzzle: Puzzle }) {
  return (
    <div className="legend" aria-label="Legend">
      <ul className="legend-rooms">
        {puzzle.rooms.map((name, room) => (
          <li key={name}>
            <span className="swatch" style={{ background: `hsl(${roomHue(room)} 55% 89%)` }} />
            {name}
          </li>
        ))}
      </ul>
      <ul className="legend-objects">
        {objectKindsIn(puzzle).map((kind) => (
          <li key={kind}>
            <span className="glyph">{GLYPH[kind]}</span> {kind}
          </li>
        ))}
      </ul>
    </div>
  )
}
