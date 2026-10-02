import type { PaintMode } from '../engine/plugin'
import type { Pos } from '../engine/types'
import type { DayProgress } from './storage'

export const HISTORY_LIMIT = 100

export interface GameState {
  progress: DayProgress
  selected: number | null
  tool: string
  history: DayProgress[]
}

export type Action =
  | { type: 'select'; suspect: number | null }
  | { type: 'setTool'; tool: string }
  | { type: 'place'; pos: Pos }
  | { type: 'remove'; suspect: number }
  | { type: 'toggleMark'; pos: Pos }
  | { type: 'paint'; cells: Pos[]; mode: PaintMode }
  | { type: 'toggleStrike'; suspect: number }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'solved'; at: number }

export const posKey = (pos: Pos): string => `${pos.r},${pos.c}`

export function newGame(dateKey: string, now: number, puzzleId?: string): GameState {
  return {
    progress: { dateKey, puzzleId, placements: {}, marks: [], struck: [], startedAt: now, solvedAt: null },
    selected: null,
    tool: 'select',
    history: [],
  }
}

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((x) => x !== item) : [...items, item]
}

/** Records the previous progress for undo, but only when the action actually changed something. */
function edit(state: GameState, progress: DayProgress, patch: Partial<GameState> = {}): GameState {
  if (progress === state.progress) return { ...state, ...patch }
  return { ...state, ...patch, progress, history: [...state.history, state.progress].slice(-HISTORY_LIMIT) }
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
  return edit(state, { ...progress, placements, marks }, { selected: null })
}

function paint(state: GameState, cells: Pos[], mode: PaintMode): GameState {
  const { progress } = state
  const keys = new Set(cells.map(posKey))
  const occupied = new Set(Object.values(progress.placements).map(posKey))
  let marks = progress.marks
  let placements = progress.placements
  if (mode === 'mark') {
    const fresh = [...keys].filter((key) => !occupied.has(key) && !marks.includes(key))
    if (fresh.length > 0) marks = [...marks, ...fresh]
  } else {
    if (marks.some((key) => keys.has(key))) marks = marks.filter((key) => !keys.has(key))
    if (mode === 'erase' && Object.values(placements).some((pos) => keys.has(posKey(pos)))) {
      placements = Object.fromEntries(Object.entries(placements).filter(([, pos]) => !keys.has(posKey(pos))))
    }
  }
  if (marks === progress.marks && placements === progress.placements) return state
  return edit(state, { ...progress, marks, placements })
}

export function reduce(state: GameState, action: Action): GameState {
  const { progress } = state
  if (progress.solvedAt !== null && action.type !== 'select' && action.type !== 'toggleStrike') return state
  switch (action.type) {
    case 'select':
      if (progress.solvedAt !== null) return state
      return { ...state, selected: action.suspect, tool: action.suspect === null ? state.tool : 'select' }
    case 'setTool':
      return { ...state, tool: action.tool, selected: action.tool === 'select' ? state.selected : null }
    case 'place':
      return placeSelected(state, action.pos)
    case 'remove': {
      const placements = { ...progress.placements }
      delete placements[action.suspect]
      return edit(state, { ...progress, placements })
    }
    case 'toggleMark':
      return edit(state, { ...progress, marks: toggle(progress.marks, posKey(action.pos)) })
    case 'paint':
      return paint(state, action.cells, action.mode)
    case 'toggleStrike':
      return { ...state, progress: { ...progress, struck: toggle(progress.struck, action.suspect) } }
    case 'undo': {
      const previous = state.history[state.history.length - 1]
      if (!previous) return state
      return { ...state, progress: previous, history: state.history.slice(0, -1), selected: null }
    }
    case 'reset':
      return edit(state, { ...progress, placements: {}, marks: [] }, { selected: null })
    case 'solved':
      return { ...state, progress: { ...progress, solvedAt: action.at } }
  }
}
