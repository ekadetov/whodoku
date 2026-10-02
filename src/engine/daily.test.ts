import { describe, expect, it } from 'vitest'
import { dailyPuzzle, dateKey, tierForDate } from './daily'

describe('dateKey', () => {
  it('uses the UTC calendar day', () => {
    expect(dateKey(new Date('2026-10-02T23:59:59Z'))).toBe('2026-10-02')
    expect(dateKey(new Date('2026-10-03T00:00:00Z'))).toBe('2026-10-03')
  })

  it('zero-pads month and day', () => {
    expect(dateKey(new Date('2027-01-05T12:00:00Z'))).toBe('2027-01-05')
  })
})

describe('tierForDate', () => {
  it.each([
    ['2026-09-28', 'easy'],
    ['2026-09-29', 'easy'],
    ['2026-09-30', 'medium'],
    ['2026-10-01', 'medium'],
    ['2026-10-02', 'hard'],
    ['2026-10-03', 'hard'],
    ['2026-10-04', 'hard'],
  ])('%s is %s', (key, tier) => {
    expect(tierForDate(key)).toBe(tier)
  })
})

describe('dailyPuzzle', () => {
  it('is the same puzzle for the same day and differs across days', () => {
    expect(dailyPuzzle('2026-10-02')).toEqual(dailyPuzzle('2026-10-02'))
    expect(dailyPuzzle('2026-10-02')).not.toEqual(dailyPuzzle('2026-10-03'))
  })

  it('uses the size of the weekday tier', () => {
    expect(dailyPuzzle('2026-09-28').size).toBe(6)
    expect(dailyPuzzle('2026-09-30').size).toBe(8)
    expect(dailyPuzzle('2026-10-02').size).toBe(9)
  })
})
