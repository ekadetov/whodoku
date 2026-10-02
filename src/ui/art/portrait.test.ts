import { describe, expect, it } from 'vitest'
import { portraitFor } from './portrait'

const NAMES = ['Ada', 'Bram', 'Cora', 'Dev', 'Elsa', 'Finn', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lena']

describe('portraitFor', () => {
  it('is deterministic for a name', () => {
    expect(portraitFor('Ada')).toEqual(portraitFor('Ada'))
  })

  it('gives different people different faces', () => {
    const faces = new Set(NAMES.map((name) => JSON.stringify(portraitFor(name))))
    expect(faces.size).toBe(NAMES.length)
  })

  it('draws a background, shoulders, a face and hair', () => {
    for (const name of NAMES) {
      const { shapes } = portraitFor(name)
      expect(shapes.length).toBeGreaterThanOrEqual(5)
      expect(shapes[0].kind).toBe('rect')
    }
  })

  it('uses only plain drawing data', () => {
    for (const shape of portraitFor('Ada').shapes) expect(['rect', 'ellipse', 'path']).toContain(shape.kind)
  })
})
