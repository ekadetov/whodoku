import { describe, expect, it } from 'vitest'
import type { Pronoun, Suspect } from '../../../engine/types'
import { FACIAL_HAIR_POOLS, HAIR_STYLES, STYLE_POOLS } from './hair'
import { portraitChoices, portraitFor } from '.'

const NAMES = ['Ada', 'Bram', 'Cora', 'Dev', 'Elsa', 'Finn', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lena']
const suspect = (name: string, pronoun: Pronoun): Suspect => ({ name, pronoun })
const many = (pronoun: Pronoun) => Array.from({ length: 80 }, (_, i) => suspect(`Person${i}`, pronoun))

describe('portraitFor', () => {
  it('is deterministic for a suspect', () => {
    expect(portraitFor(suspect('Ada', 'she'))).toEqual(portraitFor(suspect('Ada', 'she')))
  })

  it('gives different people different faces', () => {
    const faces = new Set(NAMES.map((name, i) => JSON.stringify(portraitFor(suspect(name, i % 2 ? 'he' : 'she')))))
    expect(faces.size).toBe(NAMES.length)
  })

  it('draws a background first and plain shapes only', () => {
    const { shapes } = portraitFor(suspect('Ada', 'she'))
    expect(shapes[0].kind).toBe('rect')
    expect(shapes.length).toBeGreaterThanOrEqual(8)
    for (const shape of shapes) expect(['rect', 'ellipse', 'path']).toContain(shape.kind)
  })
})

describe('portrait styles', () => {
  it('has a drawing for every style in every pool, and at least eight for she and he', () => {
    for (const pronoun of ['she', 'he', 'they'] as Pronoun[]) {
      for (const style of STYLE_POOLS[pronoun]) expect(HAIR_STYLES[style]).toBeTypeOf('function')
    }
    expect(STYLE_POOLS.she.length).toBeGreaterThanOrEqual(8)
    expect(STYLE_POOLS.he.length).toBeGreaterThanOrEqual(8)
  })

  it('keeps she and he apart: no facial hair for she, no she-only styles for he', () => {
    for (const s of many('she')) {
      const c = portraitChoices(s)
      expect(c.facialHair).toBe('none')
      expect(STYLE_POOLS.she).toContain(c.hairStyle)
    }
    const sheOnly = STYLE_POOLS.she.filter((style) => !STYLE_POOLS.they.includes(style))
    for (const s of many('he')) expect(sheOnly).not.toContain(portraitChoices(s).hairStyle)
    expect(new Set(many('he').map((s) => portraitChoices(s).facialHair)).size).toBeGreaterThan(2)
  })

  it('lets they draw from both sides', () => {
    expect(FACIAL_HAIR_POOLS.they).toContain('none')
    const styles = new Set(many('they').map((s) => portraitChoices(s).hairStyle))
    expect(styles.size).toBeGreaterThan(5)
  })

  it('honours every pinned part of a look', () => {
    const look = { hairStyle: 'bun', hairColor: '#123456', skin: '#654321', facialHair: 'goatee', shirt: '#abcdef', glasses: true }
    const c = portraitChoices({ name: 'Pinned', pronoun: 'she', look })
    expect(c).toMatchObject(look)
  })

  it('fills in whatever the look leaves out', () => {
    const c = portraitChoices({ name: 'Partial', pronoun: 'he', look: { hairStyle: 'bald' } })
    expect(c.hairStyle).toBe('bald')
    expect(c.skin).toMatch(/^#/)
  })
})
