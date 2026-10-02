import { describe, expect, it } from 'vitest'
import { classicTheme } from '../../../plugins/classic/theme'
import { STYLE_POOLS } from './hair'

describe('classic suspects', () => {
  it('each have a pinned hair style and colour, with no two alike', () => {
    expect(classicTheme.suspects.every((s) => s.look?.hairStyle && s.look.hairColor)).toBe(true)
    const pairs = classicTheme.suspects.map((s) => `${s.look?.hairStyle}/${s.look?.hairColor}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('use hair styles that fit their pronoun', () => {
    for (const s of classicTheme.suspects) expect(STYLE_POOLS[s.pronoun]).toContain(s.look?.hairStyle)
  })

  it('give she no facial hair', () => {
    for (const s of classicTheme.suspects.filter((x) => x.pronoun === 'she')) {
      expect(s.look?.facialHair ?? 'none').toBe('none')
    }
  })
})
