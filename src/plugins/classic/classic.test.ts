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

  it('registers every clue type and the victim rule', () => {
    expect(registry.clueTypes()).toHaveLength(14)
    expect(registry.rules().map((r) => r.id)).toEqual(['victim-killer'])
  })
})
