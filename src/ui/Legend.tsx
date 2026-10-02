import { objectKindsIn } from '../engine/candidates'
import type { Puzzle } from '../engine/types'
import { Sprite } from './art/Sprite'
import { spriteFor } from './art/lookup'
import { roomHue } from './palette'

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
            <Sprite sprite={spriteFor(puzzle, kind)} className="legend-sprite" /> {kind}
          </li>
        ))}
      </ul>
    </div>
  )
}
