import { generate } from './generator'
import { hashSeed } from './rng'
import type { Puzzle, Tier } from './types'

const TIER_BY_WEEKDAY: Record<number, Tier> = {
  0: 'hard',
  1: 'easy',
  2: 'easy',
  3: 'medium',
  4: 'medium',
  5: 'hard',
  6: 'hard',
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function tierForDate(key: string): Tier {
  return TIER_BY_WEEKDAY[new Date(`${key}T00:00:00Z`).getUTCDay()]
}

export function dailyPuzzle(key: string): Puzzle {
  return generate(hashSeed(`whodoku:${key}`), tierForDate(key))
}
