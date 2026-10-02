import type { CSSProperties } from 'react'
import { roomHue } from '../palette'

const TILE = 24

const PATTERNS: readonly ((ink: string) => string)[] = [
  (ink) => `<path d="M8 0V24M16 0V24" stroke="${ink}" stroke-width="1"/>`,
  (ink) => `<rect width="12" height="12" fill="${ink}"/><rect x="12" y="12" width="12" height="12" fill="${ink}"/>`,
  (ink) => `<path d="M0 8Q6 2 12 8T24 8M0 20Q6 14 12 20T24 20" fill="none" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) =>
    `<rect x="1" y="1" width="10" height="10" rx="4" fill="none" stroke="${ink}"/><rect x="13" y="13" width="10" height="10" rx="4" fill="none" stroke="${ink}"/>`,
  (ink) => `<path d="M4 8L6 3M14 20L16 15M19 9L21 4M8 22L10 17" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) => `<path d="M0 12H24M12 0V24" stroke="${ink}" stroke-width="1"/>`,
  (ink) => `<path d="M0 24L24 0M-6 6L6 -6M18 30L30 18" stroke="${ink}" stroke-width="1.5"/>`,
  (ink) => `<circle cx="6" cy="6" r="1.8" fill="${ink}"/><circle cx="18" cy="18" r="1.8" fill="${ink}"/>`,
]

/** Background of a board cell for a room: a flat color plus a tiling pattern, so rooms differ by more than hue. */
export function roomSurface(room: number): CSSProperties {
  const hue = roomHue(room)
  const ink = `hsl(${hue} 40% 70%)`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">${PATTERNS[room % PATTERNS.length](ink)}</svg>`
  return {
    backgroundColor: `hsl(${hue} 55% 87%)`,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${TILE}px ${TILE}px`,
  }
}
