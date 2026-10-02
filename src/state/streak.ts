export interface Streak {
  current: number
  best: number
  lastSolved: string | null
}

export const emptyStreak: Streak = { current: 0, best: 0, lastSolved: null }

const DAY_MS = 86_400_000

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function recordSolve(streak: Streak, dateKey: string): Streak {
  if (streak.lastSolved === dateKey) return streak
  const consecutive = streak.lastSolved !== null && dayDiff(streak.lastSolved, dateKey) === 1
  const current = consecutive ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastSolved: dateKey }
}

export function currentStreak(streak: Streak, todayKey: string): number {
  if (streak.lastSolved === null) return 0
  return dayDiff(streak.lastSolved, todayKey) <= 1 ? streak.current : 0
}
