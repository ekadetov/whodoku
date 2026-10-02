import { describe, expect, it } from 'vitest'
import { roomSurface } from './texture'

describe('roomSurface', () => {
  it('is stable for a room', () => {
    expect(roomSurface(3)).toEqual(roomSurface(3))
  })

  it('gives the first eight rooms different looks', () => {
    const looks = new Set(Array.from({ length: 8 }, (_, room) => JSON.stringify(roomSurface(room))))
    expect(looks.size).toBe(8)
  })

  it('paints a tiling svg background', () => {
    const surface = roomSurface(0)
    expect(surface.backgroundImage).toContain('data:image/svg+xml')
    expect(surface.backgroundColor).toMatch(/^hsl\(/)
    expect(surface.backgroundSize).toBe('24px 24px')
  })

  it('keeps working past the number of patterns', () => {
    expect(roomSurface(15).backgroundImage).toContain('data:image/svg+xml')
  })
})
