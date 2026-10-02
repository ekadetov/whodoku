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
  | { type: 'toggleNote'; pos: Pos; suspect: number }
  | { type: 'place'; pos: Pos; cross: Pos[] }
  | { type: 'paint'; cells: Pos[]; mode: PaintMode }
  | { type: 'toggleStrike'; suspect: number }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'solved'; at: number }
  | { type: 'failed'; at: number }
  | { type: 'restart'; now: number }

export const posKey = (pos: Pos): string => `${pos.r},${pos.c}`

export function newGame(dateKey: string, now: number, puzzleId?: string): GameState {
  return {
    progress: { dateKey, puzzleId, placements: {}, marks: [], notes: {}, struck: [], startedAt: now, solvedAt: null, failedAt: null },
    selected: null,
    tool: 'select',
    history: [],
  }
}

export const isFinished = (progress: DayProgress): boolean => progress.solvedAt !== null || (progress.failedAt ?? null) !== null

const occupiedKeys = (progress: DayProgress, except?: number): Set<string> =>
  new Set(
    Object.entries(progress.placements)
      .filter(([suspect]) => Number(suspect) !== except)
      .map(([, pos]) => posKey(pos)),
  )

function withoutNotesAt(notes: Record<string, number[]>, keys: Iterable<string>): Record<string, number[]> {
  const next = { ...notes }
  for (const key of keys) delete next[key]
  return next
}

/** Records the previous progress for undo, but only when the action actually changed something. */
function edit(state: GameState, progress: DayProgress, patch: Partial<GameState> = {}): GameState {
  if (progress === state.progress) return { ...state, ...patch }
  return { ...state, ...patch, progress, history: [...state.history, state.progress].slice(-HISTORY_LIMIT) }
}

function toggleNote(state: GameState, pos: Pos, suspect: number): GameState {
  const { progress } = state
  const key = posKey(pos)
  if (progress.marks.includes(key) || occupiedKeys(progress).has(key)) return state
  const notes = progress.notes ?? {}
  const here = notes[key] ?? []
  const next = here.includes(suspect) ? here.filter((s) => s !== suspect) : [...here, suspect]
  const updated = { ...notes }
  if (next.length > 0) updated[key] = next
  else delete updated[key]
  return edit(state, { ...progress, notes: updated })
}

function placeSelected(state: GameState, pos: Pos, cross: Pos[]): GameState {
  const { selected, progress } = state
  if (selected === null) return state
  const key = posKey(pos)
  if (progress.marks.includes(key) || occupiedKeys(progress, selected).has(key)) return state

  const placements = { ...progress.placements, [selected]: pos }
  const occupied = occupiedKeys({ ...progress, placements })
  const crossed = cross.map(posKey).filter((k) => !occupied.has(k) && !progress.marks.includes(k))
  const marks = [...progress.marks, ...new Set(crossed)]

  const kept = Object.fromEntries(
    Object.entries(progress.notes ?? {})
      .map(([k, suspects]) => [k, suspects.filter((s) => s !== selected)] as const)
      .filter(([, suspects]) => suspects.length > 0),
  )
  const notes = withoutNotesAt(kept, [key, ...crossed])
  return edit(state, { ...progress, placements, marks, notes }, { selected: null })
}

function paint(state: GameState, cells: Pos[], mode: PaintMode): GameState {
  const { progress } = state
  const keys = new Set(cells.map(posKey))
  const occupied = occupiedKeys(progress)
  const allNotes = progress.notes ?? {}
  let marks = progress.marks
  let placements = progress.placements
  let notes = allNotes
  if (mode === 'mark') {
    const fresh = [...keys].filter((key) => !occupied.has(key) && !marks.includes(key))
    if (fresh.length > 0) marks = [...marks, ...fresh]
    if (fresh.some((key) => key in allNotes)) notes = withoutNotesAt(allNotes, fresh)
  } else {
    if (marks.some((key) => keys.has(key))) marks = marks.filter((key) => !keys.has(key))
    if (mode === 'erase') {
      if (Object.values(placements).some((pos) => keys.has(posKey(pos)))) {
        placements = Object.fromEntries(Object.entries(placements).filter(([, pos]) => !keys.has(posKey(pos))))
      }
      if ([...keys].some((key) => key in allNotes)) notes = withoutNotesAt(allNotes, keys)
    }
  }
  if (marks === progress.marks && placements === progress.placements && notes === allNotes) return state
  return edit(state, { ...progress, marks, placements, notes })
}

export function reduce(state: GameState, action: Action): GameState {
  const { progress } = state
  if (isFinished(progress) && action.type !== 'toggleStrike' && action.type !== 'restart') return state
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.suspect, tool: action.suspect === null ? state.tool : 'select' }
    case 'setTool':
      return { ...state, tool: action.tool, selected: action.tool === 'select' ? state.selected : null }
    case 'toggleNote':
      return toggleNote(state, action.pos, action.suspect)
    case 'place':
      return placeSelected(state, action.pos, action.cross)
    case 'paint':
      return paint(state, action.cells, action.mode)
    case 'toggleStrike':
      return { ...state, progress: { ...progress, struck: progress.struck.includes(action.suspect) ? progress.struck.filter((s) => s !== action.suspect) : [...progress.struck, action.suspect] } }
    case 'undo': {
      const previous = state.history[state.history.length - 1]
      if (!previous) return state
      return { ...state, progress: previous, history: state.history.slice(0, -1), selected: null }
    }
    case 'reset':
      return { ...state, progress: { ...progress, placements: {}, marks: [], notes: {} }, selected: null, history: [] }
    case 'solved':
      return { ...state, progress: { ...progress, solvedAt: action.at } }
    case 'failed':
      return { ...state, progress: { ...progress, failedAt: action.at } }
    case 'restart':
      return newGame(progress.dateKey, action.now, progress.puzzleId)
  }
}
