import { describe, expect, it } from 'vitest'
import type { Plugin, SpriteDef, ThemeDef } from './plugin'
import { createRegistry } from './registry'

const SPRITE: SpriteDef = { shapes: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10 }] }

const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
  id: 't',
  rooms: ['A', 'B'],
  suspects: ['X', 'Y'],
  objects: {
    seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
    wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
  },
  ...overrides,
})

const base = (overrides: Partial<Plugin> = {}): Plugin => ({
  id: 'demo',
  version: '1.0.0',
  register(api) {
    api.addObjectKind({ id: 'seat', blocking: false })
    api.addObjectKind({ id: 'wall', blocking: true })
    api.addTheme(theme())
    api.addTool({ id: 'pen', label: 'Pen' })
  },
  ...overrides,
})

describe('registry', () => {
  it('exposes what a plugin registers', () => {
    const registry = createRegistry()
    registry.register(base())
    expect(registry.objectKind('wall').blocking).toBe(true)
    expect(registry.theme().id).toBe('t')
    expect(registry.theme('t').rooms).toEqual(['A', 'B'])
    expect(registry.tools().map((t) => t.id)).toEqual(['pen'])
    expect(registry.has('demo')).toBe(true)
  })

  it('throws a clear error for unknown ids', () => {
    const registry = createRegistry()
    expect(() => registry.objectKind('nope')).toThrow('Unknown object kind "nope"')
    expect(() => registry.theme()).toThrow('No theme registered')
  })

  it('rejects a duplicate plugin id', () => {
    const registry = createRegistry()
    registry.register(base())
    expect(() => registry.register(base())).toThrow('Duplicate plugin "demo"')
  })

  it('rejects a duplicate definition id across plugins', () => {
    const registry = createRegistry()
    registry.register(base())
    const other = base({
      id: 'other',
      register: (api) => api.addObjectKind({ id: 'seat', blocking: false }),
    })
    expect(() => registry.register(other)).toThrow('Duplicate object kind "seat" from plugin "other"')
  })

  it('rejects a missing dependency and accepts a satisfied one', () => {
    const registry = createRegistry()
    const needy = base({ id: 'needy', requires: ['demo'], register: () => {} })
    expect(() => registry.register(needy)).toThrow('requires "demo"')
    registry.register(base())
    registry.register(needy)
    expect(registry.has('needy')).toBe(true)
  })

  it('rejects bad plugin ids and versions', () => {
    const registry = createRegistry()
    expect(() => registry.register(base({ id: 'Bad Id' }))).toThrow('Invalid plugin id')
    expect(() => registry.register(base({ version: 'one' }))).toThrow('invalid version')
  })

  it('rejects an invalid clue scope and footprint', () => {
    const registry = createRegistry()
    const badScope = base({
      register: (api) =>
        api.addClueType({
          id: 'c',
          scope: 'weird' as never,
          evaluate: () => true,
          render: () => '',
        }),
    })
    expect(() => registry.register(badScope)).toThrow('invalid scope')
    const badFootprint = base({
      register: (api) => api.addObjectKind({ id: 'big', blocking: true, footprint: [{ r: 0, c: 0 }] }),
    })
    expect(() => registry.register(badFootprint)).toThrow('invalid footprint')
  })

  it('leaves the registry untouched when a plugin fails midway', () => {
    const registry = createRegistry()
    const broken = base({
      id: 'broken',
      register(api) {
        api.addObjectKind({ id: 'seat', blocking: false })
        api.addObjectKind({ id: 'seat', blocking: false })
      },
    })
    expect(() => registry.register(broken)).toThrow('Duplicate object kind')
    expect(registry.has('broken')).toBe(false)
    expect(() => registry.objectKind('seat')).toThrow('Unknown object kind')
  })

  it('fingerprints the registered plugins in a stable order', () => {
    const registry = createRegistry()
    registry.register(base({ id: 'zeta', register: () => {} }))
    registry.register(base({ id: 'alpha', version: '2.1.0', register: () => {} }))
    expect(registry.fingerprint()).toBe('alpha@2.1.0,zeta@1.0.0')
  })
})

describe('theme validation', () => {
  const withTheme = (overrides: Partial<ThemeDef>): Plugin =>
    base({
      register(api) {
        api.addObjectKind({ id: 'seat', blocking: false })
        api.addObjectKind({ id: 'wall', blocking: true })
        api.addTheme(theme(overrides))
      },
    })

  it('rejects duplicate or empty rooms and suspects', () => {
    expect(() => createRegistry().register(withTheme({ rooms: ['A', 'A'] }))).toThrow('rooms must be non-empty and unique')
    expect(() => createRegistry().register(withTheme({ suspects: [] }))).toThrow('suspects must be non-empty and unique')
  })

  it('rejects an object that is not a registered kind', () => {
    const objects = { ghost: { noun: 'a ghost', standingOn: 'on a ghost', sprite: SPRITE, weight: 0.1 } }
    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('"ghost" is not a registered object kind')
  })

  it('rejects an object without a noun or a sprite', () => {
    const objects = {
      seat: { noun: '', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0.1 },
    }
    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a noun, standingOn and a sprite')
    const blank = { ...objects, seat: { ...objects.seat, noun: 'a seat', sprite: { shapes: [] } } }
    expect(() => createRegistry().register(withTheme({ objects: blank }))).toThrow('needs a noun, standingOn and a sprite')
  })

  it('needs both a blocking and an occupiable object that can spawn', () => {
    const onlySeat = { seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 } }
    expect(() => createRegistry().register(withTheme({ objects: onlySeat }))).toThrow('at least one blocking object')
    const wallNeverSpawns = {
      seat: { noun: 'a seat', standingOn: 'on a seat', sprite: SPRITE, weight: 0.1 },
      wall: { noun: 'a wall', standingOn: 'on a wall', sprite: SPRITE, weight: 0 },
    }
    expect(() => createRegistry().register(withTheme({ objects: wallNeverSpawns }))).toThrow('at least one blocking object')
  })
})
