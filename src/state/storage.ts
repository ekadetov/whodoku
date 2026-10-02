import type { Pos } from '../engine/types'
import { emptyStreak } from './streak'
import type { Streak } from './streak'

export const STORAGE_KEY = 'whodoku'
const VERSION = 1

export interface DayProgress {
  dateKey: string
  puzzleId?: string
  placements: Record<number, Pos>
  marks: string[]
  notes?: Record<string, number[]>
  struck: number[]
  startedAt: number
  solvedAt: number | null
  failedAt?: number | null
}

export interface SavedState {
  v: typeof VERSION
  today: DayProgress | null
  history: Record<string, { solved: boolean; seconds: number }>
  streak: Streak
}

export interface ReadableStorage {
  getItem(key: string): string | null
}

export interface WritableStorage extends ReadableStorage {
  setItem(key: string, value: string): void
}

export function freshState(): SavedState {
  return { v: VERSION, today: null, history: {}, streak: emptyStreak }
}

export function loadState(storage: ReadableStorage | null): SavedState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<SavedState>
    return parsed.v === VERSION ? { ...freshState(), ...parsed } : freshState()
  } catch {
    return freshState()
  }
}

export function saveState(storage: WritableStorage | null, state: SavedState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence is best effort: private mode or a full quota must not break play.
  }
}
