import { describe, expect, it } from 'vitest'
import { currentStreak, emptyStreak, recordSolve } from './streak'

describe('recordSolve', () => {
  it('starts a streak on the first solve', () => {
    expect(recordSolve(emptyStreak, '2026-10-02')).toEqual({ current: 1, best: 1, lastSolved: '2026-10-02' })
  })

  it('extends on consecutive days, including across a month boundary', () => {
    const day1 = recordSolve(emptyStreak, '2026-09-30')
    const day2 = recordSolve(day1, '2026-10-01')
    expect(day2).toEqual({ current: 2, best: 2, lastSolved: '2026-10-01' })
  })

  it('resets to 1 after a missed day but keeps the best', () => {
    const streak = { current: 5, best: 5, lastSolved: '2026-10-01' }
    expect(recordSolve(streak, '2026-10-03')).toEqual({ current: 1, best: 5, lastSolved: '2026-10-03' })
  })

  it('is idempotent within a day', () => {
    const streak = recordSolve(emptyStreak, '2026-10-02')
    expect(recordSolve(streak, '2026-10-02')).toEqual(streak)
  })
})

describe('currentStreak', () => {
  const streak = { current: 3, best: 4, lastSolved: '2026-10-02' }

  it('shows the streak on the solve day and the next day', () => {
    expect(currentStreak(streak, '2026-10-02')).toBe(3)
    expect(currentStreak(streak, '2026-10-03')).toBe(3)
  })

  it('shows zero once a day has been missed', () => {
    expect(currentStreak(streak, '2026-10-04')).toBe(0)
  })

  it('shows zero for a fresh player', () => {
    expect(currentStreak(emptyStreak, '2026-10-02')).toBe(0)
  })
})
