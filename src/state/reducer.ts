import type { Pos } from '../engine/types'
import type { DayProgress } from './storage'

export interface GameState {
  progress: DayProgress
  selected: number | null
}

export type Action =
  | { type: 'select'; suspect: number | null }
  | { type: 'place'; pos: Pos }
  | { type: 'remove'; suspect: number }
  | { type: 'toggleMark'; pos: Pos }
  | { type: 'toggleStrike'; suspect: number }
  | { type: 'reset' }
  | { type: 'solved'; at: number }

export const posKey = (pos: Pos): string => `${pos.r},${pos.c}`

export function newGame(dateKey: string, now: number): GameState {
  return {
    progress: { dateKey, placements: {}, marks: [], struck: [], startedAt: now, solvedAt: null },
    selected: null,
  }
}

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((x) => x !== item) : [...items, item]
}

function placeSelected(state: GameState, pos: Pos): GameState {
  const { selected, progress } = state
  if (selected === null) return state
  const placements = { ...progress.placements }
  const occupant = Object.keys(placements)
    .map(Number)
    .find((s) => s !== selected && posKey(placements[s]) === posKey(pos))
  if (occupant !== undefined) {
    const previous = placements[selected]
    if (previous) placements[occupant] = previous
    else delete placements[occupant]
  }
  placements[selected] = pos
  const marks = progress.marks.filter((m) => m !== posKey(pos))
  return { progress: { ...progress, placements, marks }, selected: null }
}

export function reduce(state: GameState, action: Action): GameState {
  const { progress } = state
  if (progress.solvedAt !== null && action.type !== 'select' && action.type !== 'toggleStrike') return state
  switch (action.type) {
    case 'select':
      return progress.solvedAt !== null ? state : { ...state, selected: action.suspect }
    case 'place':
      return placeSelected(state, action.pos)
    case 'remove': {
      const placements = { ...progress.placements }
      delete placements[action.suspect]
      return { ...state, progress: { ...progress, placements } }
    }
    case 'toggleMark':
      return { ...state, progress: { ...progress, marks: toggle(progress.marks, posKey(action.pos)) } }
    case 'toggleStrike':
      return { ...state, progress: { ...progress, struck: toggle(progress.struck, action.suspect) } }
    case 'reset':
      return { progress: { ...progress, placements: {}, marks: [] }, selected: null }
    case 'solved':
      return { ...state, progress: { ...progress, solvedAt: action.at } }
  }
}
