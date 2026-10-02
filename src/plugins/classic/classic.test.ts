import { describe, expect, it } from 'vitest'
import { createRegistry } from '../../engine/registry'
import { classicPlugin } from '.'

describe('classic plugin', () => {
  const registry = createRegistry()
  registry.register(classicPlugin)

  it('keeps chairs, rugs and water walkable and everything else blocking', () => {
    const walkable = ['chair', 'rug', 'water']
    const blocking = ['table', 'shelf', 'plant', 'rock', 'tree', 'tv']
    for (const id of walkable) expect(registry.objectKind(id).blocking).toBe(false)
    for (const id of blocking) expect(registry.objectKind(id).blocking).toBe(true)
  })

  it('gives its theme a noun for every object it spawns', () => {
    const theme = registry.theme('classic')
    expect(Object.keys(theme.objects).sort()).toEqual(
      ['chair', 'plant', 'rock', 'rug', 'shelf', 'table', 'tree', 'tv', 'water'].sort(),
    )
  })

  it('draws every themed object with at least one shape', () => {
    for (const object of Object.values(registry.theme('classic').objects)) {
      expect(object.sprite.shapes.length).toBeGreaterThan(0)
    }
  })

  it('registers every clue type and the victim rule', () => {
    expect(registry.clueTypes()).toHaveLength(14)
    expect(registry.rules().map((r) => r.id)).toEqual(['victim-killer'])
  })

  it('registers the tools and the daily puzzle source', () => {
    expect(registry.tools().map((t) => t.id)).toEqual(['select', 'x', 'eraser'])
    expect(registry.puzzleSource('daily').id).toBe('daily')
  })

  it('gives the stroke tools their paint rules', () => {
    const tool = (id: string) => registry.tools().find((t) => t.id === id)!
    expect(tool('select').paint).toBeUndefined()
    expect(tool('x').paint!({ marked: false, occupied: false })).toBe('mark')
    expect(tool('x').paint!({ marked: true, occupied: false })).toBe('unmark')
    expect(tool('eraser').paint!({ marked: false, occupied: true })).toBe('erase')
    expect(tool('eraser').holdToClear).toBe(true)
    expect(tool('x').holdToClear).toBeUndefined()
  })
})
