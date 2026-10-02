import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32, pick, randInt, shuffle } from './rng'

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('hashSeed', () => {
  it('is stable and an unsigned 32-bit integer', () => {
    const h = hashSeed('2026-10-02')
    expect(hashSeed('2026-10-02')).toBe(h)
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })

  it('differs for different strings', () => {
    expect(hashSeed('2026-10-02')).not.toBe(hashSeed('2026-10-03'))
  })
})

describe('helpers', () => {
  it('randInt stays in range', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 200; i++) expect(randInt(rng, 5)).toBeLessThan(5)
  })

  it('shuffle returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffle(mulberry32(9), input)
    expect(out).toHaveLength(6)
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('pick returns a member', () => {
    expect(['a', 'b', 'c']).toContain(pick(mulberry32(4), ['a', 'b', 'c']))
  })
})
